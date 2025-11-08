import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import UnivTable from "../UnivTable/UnivTable.jsx";
import SearchFil from "../SearchFil/SearchFil.jsx";
import UsersHeader from "./UsersHeader.jsx";
import styles from "./Users.module.css";
import Pagination from "../Pagination/Pagination.jsx";
import { searchUsers, deleteUser } from "../../apis/userApi";


export default function Users() {
  const location = useLocation();
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
  const [filters, setFilters] = useState({});
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = { ...filters };
        if (searchQuery) query.search = searchQuery;
        if (activeTab && activeTab !== "All" && !query.role) query.role = activeTab;
        query.limit = query.limit ?? 100;
        query.sort = query.sort ?? "createdAt:desc";

        const hasAnyFilter = [
          'email','name','role','id','createdFrom','createdTo','lastLoggedFrom','lastLoggedTo','search'
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
  }, [activeTab, searchQuery, filters]);

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
          placeholder="Search users..."
          onSearch={(query) => setSearchQuery(query)}
          onApplyFilters={(applied) => setFilters(applied)}
          filterFields={[{ name: "role", label: "Role", type: "text", placeholder: "e.g. SUPERINTENDENT" }]}
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
          renderActions={() => (
            <button className={styles.editBtn}>Edit</button>
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
