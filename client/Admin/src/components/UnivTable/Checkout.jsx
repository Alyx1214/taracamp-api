import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { searchReservations, deleteReservation } from "../../apis/reservationApi";
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

export default function Checkout({ 
  searchQuery = "", 
  filters = {},
  currentPage: parentCurrentPage = 1,
  totalPages: parentTotalPages = 1,
  totalItems: parentTotalItems = 0,
  onPageChange: parentOnPageChange,
  onPaginationUpdate,
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
  const columns = useMemo(() => ["Name", "Email", "Service Type", "Facility Name", "Departure Date", "Actions"], []);
  
  const fetchCheckoutData = useCallback(async (page = currentPage, query = searchQuery, appliedFilters = filters, showLoading = true) => {
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
      
      // Search for checked-out reservations
      const searchParams = {
        status: 'Checked-out',
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
        departureDate: formatDateYMDToLong(r.dateOfDeparture),
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
  }, [currentPage, searchQuery, filters, onPaginationUpdate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchCheckoutData(currentPage, searchQuery, filters);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCheckoutData, currentPage, searchQuery, filters]);

  useEffect(() => setCurrentPage(parentCurrentPage), [parentCurrentPage]);
  useEffect(() => setTotalPages(parentTotalPages), [parentTotalPages]);
  useEffect(() => setTotalItems(parentTotalItems), [parentTotalItems]);

  function promptDelete(row) {
    setSelectedRow(row);
    setConfirmDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!selectedRow) return;
    try {
      setDeleting(true);
      await deleteReservation(selectedRow.id);
      // Remove from list immediately
      setRows((prev) => prev.filter((r) => r.id !== selectedRow.id));
      // Refetch the data to ensure we have the latest from server
      await fetchCheckoutData(currentPage, searchQuery, filters, false);
      setConfirmDeleteOpen(false);
      setSelectedRow(null);
    } catch (e) {
      alert(e?.message || "Failed to delete reservation");
    } finally {
      setDeleting(false);
    }
  }

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (parentOnPageChange) parentOnPageChange(page);
  };

  const renderActions = (row) => {
    if (!canDelete) {
      return (
        <>
          <button 
            className={styles["univ-approve-btn"]} 
            onClick={() => {
              if (!row.id || row.id === "N/A") {
                alert("Invalid reservation ID. Cannot view details.");
                return;
              }
              navigate(`/checkout/${row.id}/details`, {
                state: {
                  activeTab: 'Checkout',
                  filters,
                  searchQuery,
                  currentPage
                }
              });
            }}
          >
            See Detail
          </button>
        </>
      );
    }
    return (
      <>
        <button 
          className={styles["univ-delete-btn"]} 
          onClick={() => promptDelete(row)}
        >
          Delete
        </button>
      </>
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
        navigate(`/checkout/${row.id}/details`, {
          state: {
            activeTab: 'Checkout',
            filters,
            searchQuery,
            currentPage
          }
        });
      },
    },
  ] : null;

  if (err) {
    return <div style={{ padding: 16 }}>Couldn't load checked-out reservations: {err}</div>;
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
        message={`Are you sure you want to delete the reservation for ${selectedRow?.name || 'this guest'}? This action cannot be undone.`}
        confirmText="Confirm Delete"
        cancelText="Cancel"
        confirming={deleting}
        variant="danger"
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setSelectedRow(null);
        }}
        onConfirm={confirmDelete}
      />
    </>
  );
}