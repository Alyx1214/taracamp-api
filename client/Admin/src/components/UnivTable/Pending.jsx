import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { getAllReservationsByStatus, decideReservation, searchReservations } from "../../apis/reservationApi";
import ConfirmModal from "../Shared/ConfirmModal";
import { getFacilityById } from "../../apis/facilityApi";

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

export default function Pending({ 
  searchQuery = "", 
  currentPage: parentCurrentPage = 1,
  totalPages: parentTotalPages = 1,
  totalItems: parentTotalItems = 0,
  onPageChange: parentOnPageChange,
  onPaginationUpdate,
  onRefreshTab
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [confirmDeclineOpen, setConfirmDeclineOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [declining, setDeclining] = useState(false);
  const [currentPage, setCurrentPage] = useState(parentCurrentPage);
  const [totalPages, setTotalPages] = useState(parentTotalPages);
  const [totalItems, setTotalItems] = useState(parentTotalItems);

  // Check if user can approve/decline (only Superintendent)
  const role = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';
  const canApproveDecline = role === 'SUPERINTENDENT';

  const itemsPerPage = 15;
  const columns = useMemo(() => ["Name", "Email", "Service Type", "Facility Name", "Date", "Actions"], []);
  
  const fetchPendingData = useCallback(async (page = currentPage, query = searchQuery, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      let res;
      const skip = (page - 1) * itemsPerPage;
      const options = { limit: itemsPerPage, skip };

      // Fetch pending reservations or search results
      if (String(query || '').trim()) {
        const s = String(query || '').trim();
        res = await searchReservations({ query: s, ...options });
        res.reservations = (res?.reservations || []).filter(r => r.status === 'Pending');
      } else {
        res = await getAllReservationsByStatus("Pending", options);
      }

      const reservations = res?.reservations || [];

      // Use facilityName from backend response
      const list = reservations.map((r) => ({
        id: r._id || "N/A",
        name: r.guestName || "N/A",
        email: r.guestEmail || "N/A",
        serviceType: prettifyServiceType(r.serviceType) || "N/A",
        facilityName: r.facilityName || "N/A",
        date: formatDateYMDToLong(r.dateOfArrival || r.createdAt),
        _raw: r,
      }));

      setRows(list);
      const totalCount = res?.totalCount || 0;
      setTotalItems(totalCount);
      setTotalPages(Math.ceil(totalCount / itemsPerPage));

      if (onPaginationUpdate) {
        onPaginationUpdate(Math.ceil(totalCount / itemsPerPage), totalCount);
      }
      return list;
    } catch (e) {
      setErr(e?.message || "Failed to load reservations");
      throw e;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [currentPage, searchQuery, onPaginationUpdate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchPendingData();
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load reservations");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPendingData]);

  useEffect(() => setCurrentPage(parentCurrentPage), [parentCurrentPage]);
  useEffect(() => setTotalPages(parentTotalPages), [parentTotalPages]);
  useEffect(() => setTotalItems(parentTotalItems), [parentTotalItems]);

  async function onApprove(row) {
    try {
      await decideReservation(row.id, "Approved");
      // Remove from list immediately
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      // Refetch the data to ensure we have the latest from server (cache should be invalidated)
      // This ensures approved reservations don't appear in the Pending tab
      await fetchPendingData(currentPage, searchQuery, false);
      // Refresh the Approved tab so the new reservation appears there
      if (onRefreshTab) {
        onRefreshTab("Approved");
      }
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
      // Remove from list immediately
      setRows((prev) => prev.filter((r) => r.id !== selectedRow.id));
      // Refetch the data to ensure we have the latest from server (cache should be invalidated)
      // This ensures declined reservations don't appear in the Pending tab
      await fetchPendingData(currentPage, searchQuery, false);
      // Refresh the Declined tab so the new reservation appears there
      if (onRefreshTab) {
        onRefreshTab("Declined");
      }
      setConfirmDeclineOpen(false);
      setSelectedRow(null);
    } catch (e) {
      alert(e?.message || "Failed to decline reservation");
    } finally {
      setDeclining(false);
    }
  }

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (parentOnPageChange) parentOnPageChange(page);
  };

  const renderActions = (row) => {
    if (!canApproveDecline) {
      return (
        <button 
          className={styles["univ-approve-btn"]} 
          onClick={() => {
            if (!row.id || row.id === "N/A") {
              alert("Invalid reservation ID. Cannot view details.");
              return;
            }
            navigate(`/pendingRSV/${row.id}/details`);
          }}
        >
          See Detail
        </button>
      );
    }
    return (
      <>
        <button className={styles["univ-approve-btn"]} onClick={() => onApprove(row)}>Approve</button>
        <button className={styles["univ-decline-btn"]} onClick={() => promptDecline(row)}>Decline</button>
      </>
    );
  };

  const renderMenu = canApproveDecline ? (row) => [
    {
      label: "See Details",
      onClick: () => {
        if (!row.id || row.id === "N/A") {
          alert("Invalid reservation ID. Cannot view details.");
          return;
        }
        navigate(`/pendingRSV/${row.id}/details`);
      },
    },
  ] : null;

  if (err) {
    return <div style={{ padding: 16 }}>Couldn't load pending reservations: {err}</div>;
  }

  return (
    <>
      <UnivTable
        columns={columns}
        data={rows}
        loading={loading}
        renderActions={renderActions}
        renderMenu={renderMenu}
        onPageChange={handlePageChange}
        currentPage={currentPage}
        totalPages={totalPages}
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