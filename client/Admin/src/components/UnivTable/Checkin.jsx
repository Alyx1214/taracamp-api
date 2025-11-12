import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { searchReservations, checkoutReservation } from "../../apis/reservationApi";
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

export default function Checkin({ 
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
  const [confirmCheckoutOpen, setConfirmCheckoutOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [currentPage, setCurrentPage] = useState(parentCurrentPage);
  const [totalPages, setTotalPages] = useState(parentTotalPages);
  const [totalItems, setTotalItems] = useState(parentTotalItems);

  // Check if user can checkout (only Superintendent)
  const role = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';
  const canCheckout = role === 'SUPERINTENDENT';

  const itemsPerPage = 15;
  const columns = useMemo(() => ["Name", "Email", "Service Type", "Facility Name", "Date", "Actions"], []);
  
  const fetchCheckinData = useCallback(async (page = currentPage, query = searchQuery, appliedFilters = filters, showLoading = true) => {
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
      
      // Search for checked-in reservations
      const searchParams = {
        status: 'Checked-in',
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
        await fetchCheckinData(currentPage, searchQuery, filters);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCheckinData, currentPage, searchQuery, filters]);

  useEffect(() => setCurrentPage(parentCurrentPage), [parentCurrentPage]);
  useEffect(() => setTotalPages(parentTotalPages), [parentTotalPages]);
  useEffect(() => setTotalItems(parentTotalItems), [parentTotalItems]);

  function promptCheckout(row) {
    setSelectedRow(row);
    setConfirmCheckoutOpen(true);
  }

  async function confirmCheckout() {
    if (!selectedRow) return;
    try {
      setCheckingOut(true);
      await checkoutReservation(selectedRow.id);
      // Remove from list immediately
      setRows((prev) => prev.filter((r) => r.id !== selectedRow.id));
      // Refetch the data to ensure we have the latest from server
      await fetchCheckinData(currentPage, searchQuery, filters, false);
      // Refresh the Checkout tab so the new reservation appears there
      if (onRefreshTab) {
        onRefreshTab("Checkout");
      }
      setConfirmCheckoutOpen(false);
      setSelectedRow(null);
    } catch (e) {
      alert(e?.message || "Failed to checkout reservation");
    } finally {
      setCheckingOut(false);
    }
  }

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (parentOnPageChange) parentOnPageChange(page);
  };

  const renderActions = (row) => {
    if (!canCheckout) {
      return (
        <button 
          className={styles["univ-approve-btn"]} 
          onClick={() => {
            if (!row.id || row.id === "N/A") {
              alert("Invalid reservation ID. Cannot view details.");
              return;
            }
            navigate(`/checkin/${row.id}/details`, {
              state: {
                activeTab: 'Checkin',
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
      <button 
        className={styles["univ-approve-btn"]} 
        onClick={() => promptCheckout(row)}
      >
        Checkout
      </button>
    );
  };

  const renderMenu = canCheckout ? (row) => [
    {
      label: "See Details",
      onClick: () => {
        if (!row.id || row.id === "N/A") {
          alert("Invalid reservation ID. Cannot view details.");
          return;
        }
        navigate(`/checkin/${row.id}/details`, {
          state: {
            activeTab: 'Checkin',
            filters,
            searchQuery,
            currentPage
          }
        });
      },
    },
  ] : null;

  if (err) {
    return <div style={{ padding: 16 }}>Couldn't load checked-in reservations: {err}</div>;
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
      
      {/* Checkout Confirmation Modal */}
      <ConfirmModal
        open={confirmCheckoutOpen}
        title="Checkout Guest"
        message={`Are you sure you want to checkout ${selectedRow?.name || 'this guest'}? This will move them to the Checkout tab and complete their reservation.`}
        confirmText="Checkout"
        cancelText="Cancel"
        confirming={checkingOut}
        variant="success"
        onCancel={() => {
          setConfirmCheckoutOpen(false);
          setSelectedRow(null);
        }}
        onConfirm={confirmCheckout}
      />
    </>
  );
}