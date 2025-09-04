import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { getAllReservationsByStatus } from "../../apis/reservationApi"; // ← fix path if different

function formatDateYMDToLong(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatServiceType(svc) {
  if (!svc) return "N/A";
  if (svc === "ACCOMMODATION") return "Lodging";
  if (svc === "MEETING") return "Event";
  return svc;
}

export default function Approved() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

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
          serviceType: formatServiceType(r.serviceType),
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

  const renderActions = (row) => (
    <>
      <button className={styles["univ-approve-btn"]} onClick={() => navigate(`/reservations/${row.id}/edit`)}>
        Edit
      </button>
      <button className={styles["univ-decline-btn"]}>Delete</button>
    </>
  );

  const renderMenu = (row) => [
    {
      label: "Print",
      onClick: () => navigate(`/reservations/${row.id}/print`),
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
