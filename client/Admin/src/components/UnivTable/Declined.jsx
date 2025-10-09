import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { getAllReservationsByStatus, deleteReservation, searchReservations } from "../../apis/reservationApi"; 

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

export default function Declined({ searchQuery = "" }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  
  const columns = useMemo(() => ["Name", "Email", "Service Type", "Date", "Actions"], []);

  useEffect(() => {
    let cancelled = false;
    async function fetchDeclined() {
      try {
        setLoading(true);
        let res;
        if (String(searchQuery || '').trim()) {
          const s = String(searchQuery || '').trim();
          res = await searchReservations({ query: s });
          res.reservations = (res?.reservations || []).filter(r => r.status === 'Declined');
        } else {
          res = await getAllReservationsByStatus("Declined");
        }
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
    fetchDeclined();
    return () => { cancelled = true; };
  }, [searchQuery]);

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
    <>
      <button className={styles["univ-decline-btn"]} onClick={() => handleDelete(row)}>
        Delete
      </button>
    </>
  );

  const renderMenu = (row) => [
    {
      label: "View Details",
      onClick: () => navigate(`/declinedRSV/${row.id}/details`), 
    },
  ];

  if (err) {
    return <div style={{ padding: 16 }}>Couldn’t load declined reservations: {err}</div>;
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
