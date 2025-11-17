import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UnivTable from "../UnivTable/UnivTable.jsx";
import SearchFil from "../SearchFil/SearchFil.jsx";
import UsersHeader from "./UsersHeader.jsx";
import styles from "./Users.module.css";
import Pagination from "../Pagination/Pagination.jsx";
import ConfirmModal from "../Shared/ConfirmModal";
import SuccessModal from "../Users/UsersModal";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    lastLoggedFrom: "",
    lastLoggedTo: "",
    role: "",
    sortBy: ""
  });
  const [rawUsers, setRawUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function formatDate(dt) {
    // Handle null, undefined, empty string, or 0
    if (dt === null || dt === undefined || dt === "" || dt === 0) return "-";
    
    try {
      // Handle both timestamp (number) and date string/object
      const d = typeof dt === 'number' ? new Date(dt) : new Date(dt);
      
      // Check if date is valid
      if (Number.isNaN(d.getTime())) return "-";
      
      // Check if timestamp is reasonable (not epoch 0 or before 1970)
      const timestamp = d.getTime();
      if (timestamp <= 0) {
        return "-";
      }
      
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
    setSearchQuery("");
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = {};
        
        // Apply search query (general search)
        if (searchQuery && searchQuery.trim()) {
          query.search = searchQuery.trim();
        }
        
        // Apply role filter from active tab or filters
        if (activeTab && activeTab !== "All") {
          query.role = activeTab;
        } else if (filters.role && filters.role.trim()) {
          query.role = filters.role.trim();
        }

        // Apply date range filters (only if they have values)
        if (filters.lastLoggedFrom && filters.lastLoggedFrom.trim()) {
          query.lastLoggedFrom = filters.lastLoggedFrom.trim();
        }
        if (filters.lastLoggedTo && filters.lastLoggedTo.trim()) {
          query.lastLoggedTo = filters.lastLoggedTo.trim();
        }

        // Apply sorting
        if (filters.sortBy && filters.sortBy.trim()) {
          query.sort = filters.sortBy.trim();
        } else {
          query.sort = "createdAt:desc";
        }

        query.limit = 100;

        // Check if we have any filters (excluding default sort)
        const hasAnyFilter = [
          'search', 'email', 'name', 'role', 'id', 'createdFrom', 'createdTo', 'lastLoggedFrom', 'lastLoggedTo'
        ].some((k) => Boolean(query[k]));
        
        // If no filters and on "All" tab, add a date range filter to get all users
        // Use a wide date range that covers all possible dates
        if (activeTab === 'All' && !hasAnyFilter) {
          query.createdFrom = '1970-01-01';
          query.createdTo = '2099-12-31';
        }

        const res = await searchUsers(query);
        const arr = Array.isArray(res?.users) ? res.users : [];
        if (!cancelled) setRawUsers(arr);
      } catch (e) {
        if (!cancelled) setError(e?.message || e?.data?.error || 'Failed to load users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeTab, filters, searchQuery]);

  const mappedUsers = useMemo(() => {
    return (rawUsers || []).map(u => ({
      id: u?._id || "",
      name: u?.name || "",
      email: u?.email || "",
      lastLoggedIn: formatDate(u?.lastLoggedIn),
      role: u?.role || "",
    }));
  }, [rawUsers]);

  const columns = ["Name", "Email", "Last Logged In", "Role", "Actions"];

  function promptDelete(row) {
    setSelectedRow(row);
    setConfirmDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!selectedRow) return;
    try {
      setDeleting(true);
      await deleteUser(selectedRow.id);
      setRawUsers(prev => Array.isArray(prev) ? prev.filter(u => (u?._id || u?.id) !== selectedRow.id) : prev);
      setConfirmDeleteOpen(false);
      setSuccessMessage(`User "${selectedRow.name}" has been successfully deleted from the system.`);
      setSuccessModalOpen(true);
      setSelectedRow(null);
    } catch (e) {
      alert(e?.data?.error || e?.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  }

  function handleEdit(row) {
    if (!row?.id) return;
    // Navigate to edit form with user data
    navigate(`/user/edit/${row.id}`, {
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

  const handleSearch = (searchValue) => {
    setSearchQuery(searchValue || "");
  };

  const handleSuccessModalClose = () => {
    setSuccessModalOpen(false);
    setSuccessMessage("");
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
          onSearch={handleSearch}
          onApplyFilters={handleApplyFilters}
          filterFields={getFilterFields()}
          initialSearchValue={searchQuery}
          initialFilterValues={filters}
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
            <>
              <button 
                className={styles.editBtn}
                onClick={() => handleEdit(row)}
              >
                Edit
              </button>
              <button 
                className={styles.deleteBtn}
                onClick={() => promptDelete(row)}
                style={{ marginLeft: 8 }}
              >
                Delete
              </button>
            </>
          )}
        />
        {!loading && <Pagination />}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete User"
        message={`Are you sure you want to delete ${selectedRow?.name || 'this user'}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirming={deleting}
        variant="danger"
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setSelectedRow(null);
        }}
        onConfirm={confirmDelete}
      />

      {/* Success Modal */}
      <SuccessModal
        open={successModalOpen}
        message={successMessage}
        onClose={handleSuccessModalClose}
      />
    </div>
  );
}