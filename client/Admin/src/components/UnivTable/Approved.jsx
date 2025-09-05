import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { getAllReservationsByStatus, cancelReservation } from "../../apis/reservationApi"; // ← fix path if different

function formatDateYMDToLong(dateStr) {
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

export default function Approved() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const columns = useMemo(() => ["ID", "Name", "Email", "Service Type", "Date", "Actions"], []);

  useEffect(() => {
    let cancelled = false;

    async function fetchApproved() {
      try {
        setLoading(true);
        const res = await getAllReservationsByStatus("APPROVED"); 
        const list = (res?.reservations || []).map(r => ({
          id: r._id || "N/A",
          name: r.guestName || "N/A",
          email: r.guestEmail || "N/A",
          serviceType: prettifyServiceType(r.serviceType) || "N/A",
          date: formatDateYMDToLong(r.dateOfArrival || r.createdAt),
          _raw: r,
        }));
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchApproved();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCancel = async (row) => {
    if (!window.confirm("Are you sure you want to cancel this reservation?")) return;
    try {
      setCancellingId(row.id); 
      await cancelReservation(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      alert(e?.message || "Failed to cancel reservation.");
    } finally {
      setCancellingId(null);
    }
  };
  const renderActions = (row) => (
    <>
      <button className={styles["univ-approve-btn"]} onClick={() => navigate(`/reservations/${row.id}/edit`)}>
        Edit
      </button>
      <button
      className={styles["univ-decline-btn"]}
      disabled={cancellingId === row.id}
      onClick={() => handleCancel(row)}
    >
      {cancellingId === row.id ? "Cancelling..." : "Cancel"}
    </button>
    </>
  );

  const renderMenu = (row) => [
    {
      label: "See Details",
      onClick: () => navigate(`/approvedRSV/${row.id}/details`),
    },
  ];

  if (err) {
    return <div style={{ padding: 16 }}>Couldn’t load approved reservations: {err}</div>;
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
