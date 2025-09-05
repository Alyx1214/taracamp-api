import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { getAllReservationsByStatus, decideReservation } from "../../apis/reservationApi";
import ConfirmModal from "../Shared/ConfirmModal";

function formatDateYMDToLong(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatServiceType(svc) {
  if (!svc) return "N/A";
  if (String(svc).toUpperCase().includes("ACCOMMODATION")) return "Lodging";
  return "Event";
}

export default function Pending() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [confirmDeclineOpen, setConfirmDeclineOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [declining, setDeclining] = useState(false);

  const columns = useMemo(() => ["ID", "Name", "Email", "Service Type", "Date", "Actions"], []);

  useEffect(() => {
    let cancelled = false;
    async function fetchPending() {
      try {
        setLoading(true);
        const res = await getAllReservationsByStatus("PENDING");
        const list = (res?.reservations || []).map((r) => ({
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
    fetchPending();
    return () => { cancelled = true; };
  }, []);

  async function onApprove(row) {
    try {
      await decideReservation(row.id, "APPROVED");
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
      await decideReservation(selectedRow.id, "DECLINED");
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
