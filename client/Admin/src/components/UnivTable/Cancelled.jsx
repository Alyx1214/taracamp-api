import React, { useEffect, useState, useMemo } from "react";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { getAllReservationsByStatus, deleteReservation } from "../../apis/reservationApi";

function formatDateLong(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function prettifyServiceType(svc) {
  if (!svc) return "N/A";
  return String(svc)
    .split(/([\/\s])/)
    .map((w) =>
      w.match(/[a-z]/i) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w
    )
    .join("");
}

export default function Cancelled() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const columns = useMemo(() => ["ID", "Name", "Email", "Service Type", "Date", "Actions"], []);

  useEffect(() => {
    let cancelled = false;
    async function fetchCancelled() {
      try {
        setLoading(true);
        const res = await getAllReservationsByStatus("CANCELLED");
        const list = (res?.reservations || []).map(r => ({
          id: r._id || "N/A",
          name: r.guestName || "N/A",
          email: r.guestEmail || "N/A",
          serviceType: prettifyServiceType(r.serviceType) || "N/A",
          date: formatDateLong(r.dateOfArrival || r.createdAt),
          _raw: r,
        }));
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchCancelled();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (row) => {
    if (!window.confirm(`Are you sure you want to delete reservation for ${row.name}?`)) return;
    try {
      await deleteReservation(row.id);
      setRows(prev => prev.filter(r => r.id !== row.id));
      alert("Reservation deleted!");
    } catch (e) {
      alert(e?.message || "Failed to delete reservation.");
    }
  };

  const renderActions = (row) => (
    <button className={styles["univ-decline-btn"]} onClick={() => handleDelete(row)}>
      Delete
    </button>
  );

  const renderMenu = (row) => [
    {
      label: "See Details",
      onClick: () => alert(`Viewing details for ${row.name}`),
    },
  ];

  if (err) {
    return <div style={{ padding: 16 }}>Couldn’t load cancelled reservations: {err}</div>;
  }

  return (
    <UnivTable
      columns={columns}
      data={loading ? [] : rows}
      loading={loading}
      renderActions={renderActions}
      renderMenu={renderMenu}
    />
  );
}
