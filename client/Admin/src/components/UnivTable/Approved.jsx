import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { cancelReservation, searchReservations } from "../../apis/reservationApi";
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

export default function Approved({ 
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
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [currentPage, setCurrentPage] = useState(parentCurrentPage);
  const [totalPages, setTotalPages] = useState(parentTotalPages);
  const [totalItems, setTotalItems] = useState(parentTotalItems);

  // Check if user can edit/cancel (only Superintendent)
  const role = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';
  const canEditCancel = role === 'SUPERINTENDENT';

  const itemsPerPage = 15;
  const columns = useMemo(() => ["Name", "Email", "Service Type", "Facility Name", "Date", "Actions"], []);
  
  const fetchApprovedData = useCallback(async (page = currentPage, query = searchQuery, appliedFilters = filters, showLoading = true) => {
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
        status: 'Approved',
        ...options
      };
      // Only add query if there's a search term
      if (String(query || '').trim()) {
        searchParams.query = String(query).trim();
      }
      res = await searchReservations(searchParams);
      const list = (res?.reservations || []).map(r => ({
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
      setErr(e?.message || "Failed to load");
      throw e;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [currentPage, searchQuery, filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchApprovedData(currentPage, searchQuery, filters);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchApprovedData, currentPage, searchQuery, filters]);

  useEffect(() => setCurrentPage(parentCurrentPage), [parentCurrentPage]);
  useEffect(() => setTotalPages(parentTotalPages), [parentTotalPages]);
  useEffect(() => setTotalItems(parentTotalItems), [parentTotalItems]);

  function onEdit(row) {
    if (!row.id || row.id === "N/A") {
      alert("Invalid reservation ID. Cannot edit.");
      return;
    }
    navigate(`/reservations/${row.id}/edit`, {
      state: {
        activeTab: 'Approved',
        filters,
        searchQuery,
        currentPage,
        returnTo: 'Approved' // Add explicit return flag
      },
      replace: false // Keep this false so back button works
    });
  }

  function promptCancel(row) {
    setSelectedRow(row);
    setConfirmCancelOpen(true);
  }

  async function confirmCancel() {
    if (!selectedRow) return;
    try {
      setCancelling(true);
      await cancelReservation(selectedRow.id);
      // Remove from list immediately
      setRows((prev) => prev.filter((r) => r.id !== selectedRow.id));
      // Refetch the data to ensure we have the latest from server
      await fetchApprovedData(currentPage, searchQuery, filters, false);
      // Refresh the Cancelled tab so the new reservation appears there
      if (onRefreshTab) {
        onRefreshTab("Cancelled");
      }
      setConfirmCancelOpen(false);
      setSelectedRow(null);
    } catch (e) {
      alert(e?.message || "Failed to cancel reservation");
    } finally {
      setCancelling(false);
    }
  }

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (parentOnPageChange) parentOnPageChange(page);
  };

  const renderActions = (row) => {
    if (!canEditCancel) {
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
                activeTab: "Approved",
                filters,
                searchQuery,
                currentPage,
              };
              window.history.replaceState(newState, document.title);
            } catch (e) {
              // ignore errors (e.g. Safari privacy restrictions)
            }
            
            navigate(`/approvedRSV/${row.id}/details`, {
              state: {
                activeTab: 'Approved',
                filters,
                searchQuery,
                currentPage,
                returnTo: 'Approved'
              },
              replace: false
            });
          }}
        >
          See Detail
        </button>
      );
    }
    return (
      <>
        <button className={styles["univ-approve-btn"]} onClick={() => onEdit(row)}>Edit</button>
        <button className={styles["univ-decline-btn"]} onClick={() => promptCancel(row)}>Cancel</button>
      </>
    );
  };

  const renderMenu = canEditCancel ? (row) => [
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
            activeTab: "Approved",
            filters,
            searchQuery,
            currentPage,
          };
          window.history.replaceState(newState, document.title);
        } catch (e) {
          // ignore errors (e.g. Safari privacy restrictions)
        }

        navigate(`/approvedRSV/${row.id}/details`, {
          state: {
            activeTab: 'Approved',
            filters,
            searchQuery,
            currentPage,
            returnTo: 'Approved'
          },
          replace: false
        });
      },
    },
  ] : null;

  if (err) {
    return <div style={{ padding: 16 }}>Couldn't load approved reservations: {err}</div>;
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
      
      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        open={confirmCancelOpen}
        title="Cancel Reservation"
        message={`Are you sure you want to cancel this reservation from ${selectedRow?.name || 'this guest'}? The reservation will be moved to the Cancelled tab and the guest will be notified of the cancellation.`}
        confirmText="Confirm"
        cancelText="Cancel"
        confirming={cancelling}
        variant="warning"
        onCancel={() => {
          setConfirmCancelOpen(false);
          setSelectedRow(null);
        }}
        onConfirm={confirmCancel}
      />
    </>
  );
}