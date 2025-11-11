import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { deleteReservation, searchReservations } from "../../apis/reservationApi";
import ConfirmModal from "../Shared/ConfirmModal";

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

export default function Cancelled({ 
  searchQuery = "", 
  filters = {},
  currentPage: parentCurrentPage = 1,
  totalPages: parentTotalPages = 1,
  totalItems: parentTotalItems = 0,
  onPageChange: parentOnPageChange,
  onPaginationUpdate
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(parentCurrentPage);
  const [totalPages, setTotalPages] = useState(parentTotalPages);
  const [totalItems, setTotalItems] = useState(parentTotalItems);

  // Check if user can delete (only Superintendent)
  const role = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';
  const canDelete = role === 'SUPERINTENDENT';

  const itemsPerPage = 15;
  const columns = useMemo(() => ["Name", "Email", "Service Type", "Facility Name", "Date", "Actions"], []);
  
  const fetchCancelledData = useCallback(async (page = currentPage, query = searchQuery, appliedFilters = filters, showLoading = true) => {
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
        status: 'Cancelled',
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
        date: formatDateLong(r.createdAt),
        _raw: r,
      }));
      
      setRows(list);
      // Use real total count from API
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
        await fetchCancelledData(currentPage, searchQuery, filters);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load");
      }
    })();
    return () => { cancelled = true; };
  }, [fetchCancelledData, currentPage, searchQuery, filters]);

  // Sync with parent pagination state
  useEffect(() => {
    setCurrentPage(parentCurrentPage);
  }, [parentCurrentPage]);

  useEffect(() => {
    setTotalPages(parentTotalPages);
  }, [parentTotalPages]);

  useEffect(() => {
    setTotalItems(parentTotalItems);
  }, [parentTotalItems]);

  function promptDelete(row) {
    setSelectedRow(row);
    setConfirmDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!selectedRow) return;
    try {
      setDeleting(true);
      await deleteReservation(selectedRow.id);
      // Remove from list immediately (optimistic update)
      setRows(prev => prev.filter(r => String(r.id) !== String(selectedRow.id)));
      // Refetch the data to ensure we have the latest from server
      await fetchCancelledData(currentPage, searchQuery, filters, false);
      setConfirmDeleteOpen(false);
      setSelectedRow(null);
    } catch (e) {
      alert(e?.message || "Failed to delete reservation.");
    } finally {
      setDeleting(false);
    }
  }

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (parentOnPageChange) {
      parentOnPageChange(page);
    }
  };

  const renderActions = (row) => {
    if (!canDelete) {
      return (
        <button 
          className={styles["univ-approve-btn"]} 
          onClick={() => {
            if (!row.id || row.id === "N/A") {
              alert("Invalid reservation ID. Cannot view details.");
              return;
            }
            navigate(`/cancelledRSV/${row.id}/details`, {
              state: {
                activeTab: 'Cancelled',
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
      <button className={styles["univ-decline-btn"]} onClick={() => promptDelete(row)}>
        Delete
      </button>
    );
  };

  const renderMenu = canDelete ? (row) => [
    {
      label: "See Details",
      onClick: () => {
        if (!row.id || row.id === "N/A") {
          alert("Invalid reservation ID. Cannot view details.");
          return;
        }
        navigate(`/cancelledRSV/${row.id}/details`, {
          state: {
            activeTab: 'Cancelled',
            filters,
            searchQuery,
            currentPage
          }
        });
      },
    },
  ] : null;

  if (err) {
    return <div style={{ padding: 16 }}>Couldn't load cancelled reservations: {err}</div>;
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete Reservation"
        message={`Are you sure you want to permanently delete the cancelled reservation for ${selectedRow?.name || 'this guest'}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirming={deleting}
        variant="delete"
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setSelectedRow(null);
        }}
        onConfirm={confirmDelete}
      />
    </>
  );
}