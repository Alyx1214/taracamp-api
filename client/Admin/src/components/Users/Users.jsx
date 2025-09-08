import React, { useEffect, useMemo, useState } from "react";
import UnivTable from "../UnivTable/UnivTable.jsx";
import SearchFil from "../SearchFil/SearchFil.jsx";
import UsersHeader from "./UsersHeader.jsx";
import styles from "./Users.module.css";
import Pagination from "../Pagination/Pagination.jsx";
import { searchUsers, deleteUser } from "../../apis/userApi";


export default function Users() {
  const roleTabs = useMemo(
    () => [
      { label: "All", value: "ALL" },
      { label: "Front Desk", value: "FRONTDESK" },
      { label: "Staff", value: "STAFF" },
      { label: "Accounting", value: "ACCOUNTING" },
      { label: "Superintendent", value: "SUPERINTENDENT" },
    ],
    []
  );

  const [activeTab, setActiveTab] = useState("ALL");
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = { ...filters };
        if (searchQuery) query.search = searchQuery;
        if (activeTab && activeTab !== "ALL" && !query.role) query.role = activeTab;
        query.limit = query.limit ?? 100;
        query.sort = query.sort ?? "createdAt:desc";

        // Compatibility: older API returns [] when no filters are provided.
        // Ensure we include a minimal filter in the All tab to fetch records.
        const hasAnyFilter = [
          'email','name','role','id','createdFrom','createdTo','lastLoggedFrom','lastLoggedTo','search'
        ].some((k) => Boolean(query[k]));
        if (activeTab === 'ALL' && !hasAnyFilter) {
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

  const filteredData = useMemo(() => {
    // Exclude GUEST and CRMS/CRMSTEAM roles globally from All/results
    const role = (u) => String(u.role || "").toUpperCase();
    const EXCLUDED = new Set(["GUEST", "CRMS TEAM", "CRMSTEAM"]);
    return mappedUsers.filter(u => !EXCLUDED.has(role(u)));
  }, [mappedUsers]);

  const columns = ["ID", "Name", "Email", "Last Logged In", "Role", "Actions"];

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
        {loading ? (
          <div style={{ padding: '16px' }}>Loading users…</div>
        ) : (
          <>
            <UnivTable
              columns={columns}
              data={filteredData}
              renderActions={() => (
                <button className={styles.editBtn}>Edit</button>
              )}
              renderMenu={(row) => [
                { label: "Delete", onClick: () => handleDelete(row) },
                { label: "View", onClick: () => alert(`Viewing ${row.name}`) },
              ]}
            />
            <Pagination />
          </>
        )}
      </div>
    </div>
  );
}
