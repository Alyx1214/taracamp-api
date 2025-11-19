import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { decideReservation, searchReservations } from "../../apis/reservationApi";
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
  filters = {},
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
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [declining, setDeclining] = useState(false);
  const [approving, setApproving] = useState(false);
  const [currentPage, setCurrentPage] = useState(parentCurrentPage);
  const [totalPages, setTotalPages] = useState(parentTotalPages);
  const [totalItems, setTotalItems] = useState(parentTotalItems);

  // Check if user can approve/decline (Superintendent and CRMS Team)
  const role = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';
  const canApproveDecline = role === 'SUPERINTENDENT' || role === 'CRMS TEAM' || role === 'CRMS Team';

  const itemsPerPage = 15;
  const columns = useMemo(() => ["Name", "Email", "Service Type", "Facility Name", "Date", "Actions"], []);
  
  const fetchPendingData = useCallback(async (page = currentPage, query = searchQuery, appliedFilters = filters, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      let res;
      const skip = (page - 1) * itemsPerPage;
      const options = { 
        limit: itemsPerPage, 
        skip
      };
      if (appliedFilters?.serviceType) options.serviceType = appliedFilters.serviceType;
      if (appliedFilters?.category) options.category = appliedFilters.category;
      if (appliedFilters?.startDate) options.startDate = appliedFilters.startDate;
      if (appliedFilters?.endDate) options.endDate = appliedFilters.endDate;
      if (appliedFilters?.sortBy) options.sortBy = appliedFilters.sortBy;

      // Always use searchReservations - it supports status and all filters
      const searchParams = {
        status: 'Pending',
        ...options
      };
      // Only add query if there's a search term
      if (String(query || '').trim()) {
        searchParams.query = String(query).trim();
      }
      res = await searchReservations(searchParams);

      const reservations = res?.reservations || [];

      // Use facilityName from backend response
      const list = reservations.map((r) => ({
        id: r._id || "N/A",
        name: r.guestName || "N/A",
        email: r.guestEmail || "N/A",
        serviceType: prettifyServiceType(r.serviceType) || "N/A",
        facilityName: r.facilityName || "N/A",
        date: formatDateYMDToLong(r.createdAt),
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
  }, [currentPage, searchQuery, filters]);

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

  function promptApprove(row) {
    setSelectedRow(row);
    setConfirmApproveOpen(true);
  }

  async function confirmApprove() {
    if (!selectedRow) return;
    try {
      setApproving(true);
      await decideReservation(selectedRow.id, "Approved");
      // Remove from list immediately
      setRows((prev) => prev.filter((r) => r.id !== selectedRow.id));
      // Refetch the data to ensure we have the latest from server
      await fetchPendingData(undefined, undefined, undefined, false);
      // Refresh the Approved tab so the new reservation appears there
      if (onRefreshTab) {
        onRefreshTab("Approved");
      }
      setConfirmApproveOpen(false);
      setSelectedRow(null);
    } catch (e) {
      alert(e?.message || "Failed to approve reservation");
    } finally {
      setApproving(false);
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
      // Refetch the data to ensure we have the latest from server
      await fetchPendingData(undefined, undefined, undefined, false);
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
            try {
              const existingState = (window.history && window.history.state) || {};
              const newState = {
                ...existingState,
                activeTab: "Pending",
                filters,
                searchQuery,
                currentPage,
              };
              window.history.replaceState(newState, document.title);
            } catch (e) {
              // ignore errors (e.g. Safari privacy restrictions)
            }
            navigate(`/pendingRSV/${row.id}/details`, {
              state: {
                activeTab: 'Pending',
                filters,
                searchQuery,
                currentPage
              }
            });
          }}
        >
          See Detail
        </button>
      );
    }
    return (
      <>
        <button className={styles["univ-approve-btn"]} onClick={() => promptApprove(row)}>Approve</button>
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
        try {
          const existingState = (window.history && window.history.state) || {};
          const newState = {
            ...existingState,
            activeTab: "Pending",
            filters,
            searchQuery,
            currentPage,
          };
          window.history.replaceState(newState, document.title);
        } catch (e) {
          // ignore errors (e.g. Safari privacy restrictions)
        }

        navigate(`/pendingRSV/${row.id}/details`, {
          state: {
            activeTab: 'Pending',
            filters,
            searchQuery,
            currentPage
          }
        });
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
      
      {/* Approve Confirmation Modal */}
      <ConfirmModal
        open={confirmApproveOpen}
        title="Approve Reservation"
        message={`Are you sure you want to approve this reservation from ${selectedRow?.name || 'this guest'}? This will approve their reservation and notify them of the approval.`}
        confirmText="Approve"
        cancelText="Cancel"
        confirming={approving}
        variant="success"
        onCancel={() => {
          setConfirmApproveOpen(false);
          setSelectedRow(null);
        }}
        onConfirm={confirmApprove}
      />

      {/* Decline Confirmation Modal */}
      <ConfirmModal
        open={confirmDeclineOpen}
        title="Decline Reservation"
        message={`Are you sure you want to decline this reservation from ${selectedRow?.name || 'this guest'}? They will be notified that the reservation has been declined.`}
        confirmText="Decline"
        cancelText="Cancel"
        confirming={declining}
        variant="danger"
        onCancel={() => {
          setConfirmDeclineOpen(false);
          setSelectedRow(null);
        }}
        onConfirm={confirmDecline}
      />
    </>
  );
}