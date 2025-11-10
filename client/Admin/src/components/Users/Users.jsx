import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UnivTable from "../UnivTable/UnivTable.jsx";
import SearchFil from "../SearchFil/SearchFil.jsx";
import UsersHeader from "./UsersHeader.jsx";
import styles from "./Users.module.css";
import Pagination from "../Pagination/Pagination.jsx";
import { searchUsers, deleteUser } from "../../apis/userApi";


export default function Users() {
  const location = useLocation();
  const navigate = useNavigate();
  const roleTabs = useMemo(
    () => [
      { label: "All", value: "All" },
      { label: "Guest", value: "Guest" },
      { label: "Front Desk", value: "Frontdesk" },
      { label: "Staff", value: "CRMS Team" },
      { label: "Accounting", value: "Accounting" },
      { label: "Superintendent", value: "Superintendent" },
    ],
    []
  );

  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "All");
  const [filters, setFilters] = useState({
    lastLoggedFrom: "",
    lastLoggedTo: "",
    role: "",
    sortBy: ""
  });
  const [rawUsers, setRawUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function formatDate(dt) {
    if (!dt) return "-";
    try {
      const d = new Date(dt);
      if (Number.isNaN(d.getTime())) return "-";
      return d.toLocaleString();
    } catch {
      return "-";
    }
  }

  // Sync activeTab with location state changes
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  // Reset filters when active tab changes
  useEffect(() => {
    setFilters({
      lastLoggedFrom: "",
      lastLoggedTo: "",
      role: "",
      sortBy: ""
    });
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = { ...filters };
        
        // Apply role filter from active tab or filters
        if (activeTab && activeTab !== "All") {
          query.role = activeTab;
        } else if (filters.role) {
          query.role = filters.role;
        }

        // Apply date range filters
        if (filters.lastLoggedFrom) {
          query.lastLoggedFrom = filters.lastLoggedFrom;
        }
        if (filters.lastLoggedTo) {
          query.lastLoggedTo = filters.lastLoggedTo;
        }

        // Apply sorting
        if (filters.sortBy) {
          query.sort = filters.sortBy;
        } else {
          query.sort = "createdAt:desc";
        }

        query.limit = query.limit ?? 100;

        const hasAnyFilter = [
          'email','name','role','id','createdFrom','createdTo','lastLoggedFrom','lastLoggedTo'
        ].some((k) => Boolean(query[k]));
        if (activeTab === 'All' && !hasAnyFilter) {
          query.createdFrom = '1970-01-01';
        }

        const res = await searchUsers(query);
        const arr = Array.isArray(res?.users) ? res.users : [];
        if (!cancelled) setRawUsers(arr);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeTab, filters]);

  const mappedUsers = useMemo(() => {
    return (rawUsers || []).map(u => ({
      id: u?._id || "",
      name: u?.name || "",
      email: u?.email || "",
      lastloggedin: formatDate(u?.lastLoggedIn),
      role: u?.role || "",
    }));
  }, [rawUsers]);

  const columns = ["Name", "Email", "Last Logged In", "Role", "Actions"];

  async function handleDelete(row) {
    if (!row?.id) return;
    const confirmed = window.confirm(`Delete user ${row.name || row.id}?`);
    if (!confirmed) return;
    try {
      await deleteUser(row.id);
      setRawUsers(prev => Array.isArray(prev) ? prev.filter(u => (u?._id || u?.id) !== row.id) : prev);
    } catch (e) {
      alert(e?.data?.error || e?.message || 'Failed to delete user');
    }
  }

  function handleEdit(row) {
    if (!row?.id) return;
    // Navigate to edit form with user data
    navigate(`/users/edit/${row.id}`, {
      state: {
        user: {
          id: row.id,
          name: row.name || "",
          email: row.email || "",
          role: row.role || "",
        }
      }
    });
  }

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters || {});
  };

  // Define filter fields for users
  const getFilterFields = () => {
    return [
      {
        name: "lastLoggedFrom",
        label: "Last Logged In (From)",
        type: "date"
      },
      {
        name: "lastLoggedTo",
        label: "Last Logged In (To)",
        type: "date"
      },
      {
        name: "role",
        label: "Role",
        type: "select",
        options: [
          { value: "", label: "All Roles" },
          { value: "Guest", label: "Guest" },
          { value: "Frontdesk", label: "Front Desk" },
          { value: "CRMS Team", label: "Staff" },
          { value: "Accounting", label: "Accounting" },
          { value: "Superintendent", label: "Superintendent" }
        ]
      },
      {
        name: "sortBy",
        label: "Sort By",
        type: "select",
        options: [
          { value: "", label: "None" },
          { value: "name:asc", label: "Name (A-Z)" },
          { value: "name:desc", label: "Name (Z-A)" },
          { value: "lastLoggedIn:asc", label: "Last Logged In (Earliest First)" },
          { value: "lastLoggedIn:desc", label: "Last Logged In (Latest First)" },
          { value: "role:asc", label: "Role (A-Z)" },
          { value: "createdAt:desc", label: "Created Date (Latest First)" },
          { value: "createdAt:asc", label: "Created Date (Earliest First)" }
        ]
      }
    ];
  };

  return (
    <div className={styles["users-container"]}>
      <UsersHeader />
      <div className={styles["controlsContainer"]}>
        <div className={styles.roleTabsContainer}>
          {roleTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`${styles.roleTabBtn} ${activeTab === tab.value ? styles.active : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <SearchFil
          onApplyFilters={handleApplyFilters}
          filterFields={getFilterFields()}
        />
      </div>

      <div className={styles.tableShiftRight}>
        {error && (
          <div role="alert" style={{ color: '#b00020', marginBottom: '8px' }}>{error}</div>
        )}
        <UnivTable
          columns={columns}
          data={mappedUsers}
          loading={loading}
          renderActions={(row) => (
            <button 
              className={styles.editBtn}
              onClick={() => handleEdit(row)}
            >
              Edit
            </button>
          )}
          renderMenu={(row) => [
            { label: "Delete", onClick: () => handleDelete(row) },
            { label: "View", onClick: () => alert(`Viewing ${row.name}`) },
          ]}
        />
        {!loading && <Pagination />}
      </div>
    </div>
  );
}