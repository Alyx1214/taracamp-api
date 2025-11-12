import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { searchReservations, checkInReservation } from "../../apis/reservationApi";
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

export default function ConfirmedCheckInOut({ 
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
  const [confirmCheckInOpen, setConfirmCheckInOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [currentPage, setCurrentPage] = useState(parentCurrentPage);
  const [totalPages, setTotalPages] = useState(parentTotalPages);
  const [totalItems, setTotalItems] = useState(parentTotalItems);

  // Check if user can check-in (only Superintendent)
  const role = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';
  const canCheckIn = role === 'SUPERINTENDENT';

  const itemsPerPage = 15;
  const columns = useMemo(() => ["Name", "Email", "Service Type", "Facility Name", "Arrival Date", "Actions"], []);
  
  const fetchConfirmedData = useCallback(async (page = currentPage, query = searchQuery, appliedFilters = filters, showLoading = true) => {
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
      
      // Search for confirmed reservations
      const searchParams = {
        status: 'Confirmed',
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
        arrivalDate: formatDateYMDToLong(r.dateOfArrival),
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
        await fetchConfirmedData(currentPage, searchQuery, filters);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchConfirmedData, currentPage, searchQuery, filters]);

  useEffect(() => setCurrentPage(parentCurrentPage), [parentCurrentPage]);
  useEffect(() => setTotalPages(parentTotalPages), [parentTotalPages]);
  useEffect(() => setTotalItems(parentTotalItems), [parentTotalItems]);

  function promptCheckIn(row) {
    setSelectedRow(row);
    setConfirmCheckInOpen(true);
  }

  async function confirmCheckIn() {
    if (!selectedRow) return;
    try {
      setCheckingIn(true);
      await checkInReservation(selectedRow.id);
      // Remove from list immediately
      setRows((prev) => prev.filter((r) => r.id !== selectedRow.id));
      // Refetch the data to ensure we have the latest from server
      await fetchConfirmedData(currentPage, searchQuery, filters, false);
      // Refresh the Checkin tab so the new reservation appears there
      if (onRefreshTab) {
        onRefreshTab("Checkin");
      }
      setConfirmCheckInOpen(false);
      setSelectedRow(null);
    } catch (e) {
      alert(e?.message || "Failed to check-in reservation");
    } finally {
      setCheckingIn(false);
    }
  }

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (parentOnPageChange) parentOnPageChange(page);
  };

  const renderActions = (row) => {
    if (!canCheckIn) {
      return (
        <>
          <button 
            className={styles["univ-approve-btn"]} 
            onClick={() => {
              if (!row.id || row.id === "N/A") {
                alert("Invalid reservation ID. Cannot view details.");
                return;
              }
              navigate(`/confirmed/${row.id}/details`, {
                state: {
                  activeTab: 'Confirmed',
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
          className={styles["univ-edit-btn"]} 
          onClick={() => {
            if (!row.id || row.id === "N/A") {
              alert("Invalid reservation ID. Cannot edit.");
              return;
            }
            navigate(`/reservations/${row.id}/edit`, {
              state: {
                activeTab: 'Confirmed',
                filters,
                searchQuery,
                currentPage
              }
            });
          }}
          style={{ marginRight: 8 }}
        >
          Edit
        </button>
        <button 
          className={styles["univ-approve-btn"]} 
          onClick={() => promptCheckIn(row)}
        >
          Check-In
        </button>
      </>
    );
  };

  const renderMenu = canCheckIn ? (row) => [
    {
      label: "See Details",
      onClick: () => {
        if (!row.id || row.id === "N/A") {
          alert("Invalid reservation ID. Cannot view details.");
          return;
        }
        navigate(`/confirmed/${row.id}/details`, {
          state: {
            activeTab: 'Confirmed',
            filters,
            searchQuery,
            currentPage
          }
        });
      },
    },
  ] : null;

  if (err) {
    return <div style={{ padding: 16 }}>Couldn't load confirmed reservations: {err}</div>;
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
      
      {/* Check-In Confirmation Modal */}
      <ConfirmModal
        open={confirmCheckInOpen}
        title="Check-In Guest"
        message={`Are you sure you want to check-in ${selectedRow?.name || 'this guest'}? This will move them to the Check-In tab.`}
        confirmText="Check-In"
        cancelText="Cancel"
        confirming={checkingIn}
        variant="success"
        onCancel={() => {
          setConfirmCheckInOpen(false);
          setSelectedRow(null);
        }}
        onConfirm={confirmCheckIn}
      />
    </>
  );
}