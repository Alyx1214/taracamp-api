import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { getAllReservationsByStatus, decideReservation, searchReservations } from "../../apis/reservationApi";
import ConfirmModal from "../Shared/ConfirmModal";

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

export default function Pending({ searchQuery = "" }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [confirmDeclineOpen, setConfirmDeclineOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [declining, setDeclining] = useState(false);

  const columns = useMemo(() => ["Name", "Email", "Service Type", "Date", "Actions"], []);

  useEffect(() => {
    let cancelled = false;
    async function fetchPending() {
      try {
        setLoading(true);
        let res;
        if (String(searchQuery || '').trim()) {
          const s = String(searchQuery || '').trim();
          res = await searchReservations({ query: s });
          res.reservations = (res?.reservations || []).filter(r => r.status === 'Pending');
        } else {
          res = await getAllReservationsByStatus("Pending");
        }
        const list = (res?.reservations || []).map((r) => ({
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
    fetchPending();
    return () => { cancelled = true; };
  }, [searchQuery]);

  async function onApprove(row) {
    try {
      await decideReservation(row.id, "Approved");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      alert(e?.message || "Failed to approve reservation");
    }
  }

  function promptDecline(row) {
    setSelectedRow(row);
    setConfirmDeclineOpen(true);
  }

  async function confirmDecline() {
    if (!selectedRow) return;
    try {
      setDeclining(true);
      await decideReservation(selectedRow.id, "Declined");
      setRows((prev) => prev.filter((r) => r.id !== selectedRow.id));
      setConfirmDeclineOpen(false);
      setSelectedRow(null);
    } catch (e) {
      alert(e?.message || "Failed to decline reservation");
    } finally {
      setDeclining(false);
    }
  }

  const renderActions = (row) => (
    <>
      <button className={styles["univ-approve-btn"]} onClick={() => onApprove(row)}>Approve</button>
      <button className={styles["univ-decline-btn"]} onClick={() => promptDecline(row)}>Decline</button>
    </>
  );

  const renderMenu = (row) => [
    {
      label: "See Details",
      onClick: () => navigate(`/pendingRSV/${row.id}/details`),
    },
  ];

  if (err) {
    return <div style={{ padding: 16 }}>Couldn’t load pending reservations: {err}</div>;
  }

  return (
    <>
      <UnivTable
        columns={columns}
        data={loading ? [] : rows}
        renderActions={renderActions}
        renderMenu={renderMenu}
      />
      <ConfirmModal
        open={confirmDeclineOpen}
        title="Decline Reservation"
        message="Are you sure you want to decline this reservation?"
        confirmText="Decline"
        cancelText="Cancel"
        confirming={declining}
        onCancel={() => {
          setConfirmDeclineOpen(false);
          setSelectedRow(null);
        }}
        onConfirm={confirmDecline}
      />
    </>
  );
}
