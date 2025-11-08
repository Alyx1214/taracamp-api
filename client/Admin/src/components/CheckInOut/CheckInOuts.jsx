import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./CheckInOuts.module.css";
import CheckTabs from "./CheckTabs";
import CheckHead from "./CheckHead";
import UnivTable from "../UnivTable/UnivTable"; 
import SearchFil from "../SearchFil/SearchFil";
import { searchReservations, checkInOrCheckOutReservation, deleteReservation } from "../../apis/reservationApi";

export default function CheckInOuts() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Confirmed");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({});

  const columns = ["Name", "Email", "Service Type", "Date", "Actions"];

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const statusForTab = (tab) => {
    if (tab === "Confirmed") return "Confirmed"; 
    if (tab === "Check-in") return "Checked-in";
    if (tab === "Check-out") return "Checked-out";
    return "";
  };

  const formatDateYMDToLong = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  };

  const prettifyServiceType = (svc) => {
    if (!svc) return "N/A";
    return String(svc)
      .split(/([\/\s])/)
      .map((w) => (w.match(/[a-z]/i) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
      .join("");
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setErr(null);
        const status = statusForTab(activeTab);
        if (!status) { setRows([]); return; }
        const params = { status };
        const combinedQuery = [searchQuery, filters?.serviceType].filter(Boolean).join(" ").trim();
        if (combinedQuery) params.query = combinedQuery;
        if (filters?.date) {
          params.start = filters.date;
          params.end = filters.date;
        }
        const res = await searchReservations(params);
        const list = (res?.reservations || []).map((r) => ({
          id: r._id || "",
          name: r.guestName || "N/A",
          email: r.guestEmail || "N/A",
          serviceType: prettifyServiceType(r.serviceType) || "N/A",
          date: formatDateYMDToLong(r.dateOfArrival || r.createdAt),
          _raw: r,
        }));
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) setErr(e?.data?.error || e?.message || "Failed to load reservations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeTab, searchQuery, filters]);

  const renderMenu = (row) => [
    { 
      label: "View", 
      onClick: () => {
        if (!row.id || row.id === "") {
          alert("Invalid reservation ID. Cannot view details.");
          return;
        }
        navigate(`/reservation/${row.id}/details`);
      }
    },
    { label: "Edit", onClick: () => alert(`Editing ${row.name}`) },
  ];

  const [actionId, setActionId] = useState(null);

  const doAction = async (row, nextStatus) => {
    try {
      setActionId(row.id);
      await checkInOrCheckOutReservation(row.id, nextStatus);
      // Refresh with current filters
      const status = statusForTab(activeTab);
      const params = { status };
      const combinedQuery = [searchQuery, filters?.serviceType].filter(Boolean).join(" ").trim();
      if (combinedQuery) params.query = combinedQuery;
      if (filters?.date) { params.start = filters.date; params.end = filters.date; }
      const res = await searchReservations(params);
      const list = (res?.reservations || []).map((r) => ({
        id: r._id || "",
        name: r.guestName || "N/A",
        email: r.guestEmail || "N/A",
        serviceType: prettifyServiceType(r.serviceType) || "N/A",
        date: formatDateYMDToLong(r.dateOfArrival || r.createdAt),
        _raw: r,
      }));
      setRows(list);
    } catch (e) {
      alert(e?.data?.error || e?.message || 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  const renderApprovedActions = (row) => (
    <>
      <button
        className={`${styles.pillBtn} ${styles.editBtn}`}
        onClick={() => alert(`Editing ${row.name}`)}
        style={{ marginLeft: 8 }}
      >
        Edit
      </button>
      <button
      className={`${styles.pillBtn} ${styles.checkInBtn}`}
      disabled={actionId === row.id}
      onClick={() => doAction(row, 'Checked-in')}
    >
      {actionId === row.id ? 'Checking in…' : 'Check-In'}
    </button>
    </>
  );

  const renderCheckInActions = (row) => (
    <>
      <button
        className={`${styles.pillBtn} ${styles.editBtn}`}
        onClick={() => alert(`Editing ${row.name}`)}
        style={{ marginLeft: 8 }}
      >
        Edit
      </button>
      <button
        className={`${styles.pillBtn} ${styles.checkOutBtn}`}
        disabled={actionId === row.id}
        onClick={() => doAction(row, 'Checked-out')}
      >
        {actionId === row.id ? 'Checking out…' : 'Check-Out'}
      </button>
      
    </>
  );

  const renderCheckOutActions = (row) => (
    <DeleteButton row={row} />
  );

  const [deleteId, setDeleteId] = useState(null);

  const handleDelete = async (row) => {
    if (!window.confirm('Are you sure you want to delete this reservation?')) return;
    try {
      setDeleteId(row.id);
      await deleteReservation(row.id);
      // Refresh current tab with filters after delete
      const status = statusForTab(activeTab);
      const params = { status };
      const combinedQuery = [searchQuery, filters?.serviceType].filter(Boolean).join(" ").trim();
      if (combinedQuery) params.query = combinedQuery;
      if (filters?.date) { params.start = filters.date; params.end = filters.date; }
      const res = await searchReservations(params);
      const list = (res?.reservations || []).map((r) => ({
        id: r._id || "",
        name: r.guestName || "N/A",
        email: r.guestEmail || "N/A",
        serviceType: prettifyServiceType(r.serviceType) || "N/A",
        date: formatDateYMDToLong(r.dateOfArrival || r.createdAt),
        _raw: r,
      }));
      setRows(list);
    } catch (e) {
      alert(e?.data?.error || e?.message || 'Failed to delete reservation');
    } finally {
      setDeleteId(null);
    }
  };

  const DeleteButton = ({ row }) => (
    <button
      className={`${styles.pillBtn} ${styles.deleteBtn}`}
      disabled={deleteId === row.id}
      onClick={() => handleDelete(row)}
    >
      {deleteId === row.id ? 'Deleting…' : 'Delete'}
    </button>
  );

  // Server-side filtering; just render rows
  const getActiveData = () => rows;

  return (
    <div className={styles.container}>
      <CheckHead />

      <div className={styles.headerRow}>
        <CheckTabs value={activeTab} onChange={setActiveTab} />

        <SearchFil
          placeholder={`Search in ${activeTab}`}
          onSearch={setSearchQuery}
          onApplyFilters={setFilters}
          filterFields={[
            { name: "serviceType", label: "Service Type", placeholder: "Event / Lodging" },
            { name: "date", label: "Date", type: "date" },
          ]}
        />
      </div>

      <div className={styles.content}>
        {err && <div style={{ padding: 12, color: '#b00' }}>{String(err)}</div>}
        {loading && <div style={{ padding: 12 }}>Loading…</div>}
        {!loading && activeTab === "Confirmed" && (
          <UnivTable
            columns={columns}
            data={getActiveData()}
            renderActions={renderApprovedActions}
            renderMenu={renderMenu}
          />
        )}
        {!loading && activeTab === "Check-in" && (
          <UnivTable
            columns={columns}
            data={getActiveData()}
            renderActions={renderCheckInActions}
            renderMenu={renderMenu}
          />
        )}
        {!loading && activeTab === "Check-out" && (
          <UnivTable
            columns={columns}
            data={getActiveData()}
            renderActions={renderCheckOutActions}
            renderMenu={renderMenu}
          />
        )}
      </div>
    </div>
  );
}
