import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { searchReservations } from "../../apis/reservationApi"; 

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

export default function Confirmed({ 
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
  const [currentPage, setCurrentPage] = useState(parentCurrentPage);
  const [totalPages, setTotalPages] = useState(parentTotalPages);
  const [totalItems, setTotalItems] = useState(parentTotalItems);

  const itemsPerPage = 15;
  const columns = useMemo(() => ["Name", "Email", "Service Type", "Facility Name", "Date", "Actions"], []);
  
  // Memoize filters to prevent unnecessary re-renders
  const filtersString = useMemo(() => JSON.stringify(filters || {}), [
    filters?.serviceType,
    filters?.category,
    filters?.startDate,
    filters?.endDate,
    filters?.sortBy
  ]);
  
  useEffect(() => {
    let cancelled = false;
    async function fetchConfirmed() {
      try {
        setLoading(true);
        let res;
        const skip = (currentPage - 1) * itemsPerPage;
        const options = { 
          limit: itemsPerPage, 
          skip
        };
        if (filters?.serviceType) options.serviceType = filters.serviceType;
        if (filters?.category) options.category = filters.category;
        if (filters?.startDate) options.startDate = filters.startDate;
        if (filters?.endDate) options.endDate = filters.endDate;
        if (filters?.sortBy) options.sortBy = filters.sortBy;
        
        // Always use searchReservations - it supports status and all filters
        const searchParams = {
          status: 'Confirmed',
          ...options
        };
        // Only add query if there's a search term
        if (String(searchQuery || '').trim()) {
          searchParams.query = String(searchQuery).trim();
        }
        res = await searchReservations(searchParams);
        const list = (res?.reservations || []).map(r => ({
          id: r._id || "N/A",
          name: r.guestName || "N/A",
          email: r.guestEmail || "N/A", 
          serviceType: prettifyServiceType(r.serviceType) || "N/A",
          facilityName: r.facilityName || "N/A",
          date: formatDateLong(r.createdAt),
          guestType: r.guestType || 'INDIVIDUAL',
          _raw: r,
        }));
        
        if (!cancelled) {
          setRows(list);
          // Use real total count from API
          const totalCount = res?.totalCount || 0;
          setTotalItems(totalCount);
          setTotalPages(Math.ceil(totalCount / itemsPerPage));
          
          if (onPaginationUpdate) {
            onPaginationUpdate(Math.ceil(totalCount / itemsPerPage), totalCount);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchConfirmed();
    return () => { cancelled = true; };
  }, [searchQuery, currentPage, filtersString]);

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

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (parentOnPageChange) {
      parentOnPageChange(page);
    }
  };

  const renderActions = (row) => (
    <>
      <button className={styles["univ-approve-btn"]} onClick={() => {
        if (!row.id || row.id === "N/A") {
          alert("Invalid reservation ID. Cannot edit.");
          return;
        }
        try {
          const existingState = (window.history && window.history.state) || {};
          const newState = {
            ...existingState,
            activeTab: "Confirmed",
            filters,
            searchQuery,
            currentPage,
          };
          window.history.replaceState(newState, document.title);
        } catch (e) {
          // ignore errors (e.g. Safari privacy restrictions)
        }

        navigate(`/reservations/${row.id}/edit`, {
          state: {
            activeTab: 'Confirmed',
            filters,
            searchQuery,
            currentPage
          }
        });
      }}>
        Edit
      </button>
    </>
  );

  const renderMenu = (row) => [
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
            activeTab: "Confirmed",
            filters,
            searchQuery,
            currentPage,
          };
          window.history.replaceState(newState, document.title);
        } catch (e) {
          // ignore errors (e.g. Safari privacy restrictions)
        }

        row.guestType === "GROUP"
          ? navigate(`/confirmedGroup/${row.id}/details`, {
              state: {
                activeTab: 'Confirmed',
                filters,
                searchQuery,
                currentPage
              }
            })
          : navigate(`/confirmedIndiv/${row.id}/details`, {
              state: {
                activeTab: 'Confirmed',
                filters,
                searchQuery,
                currentPage
              }
            });
      }
    }
  ];

  if (err) {
    return <div style={{ padding: 16 }}>Couldn’t load confirmed reservations: {err}</div>;
  }

  return (
    <UnivTable
      columns={columns}
      data={rows}
      loading={loading}
      renderActions={renderActions}
      renderMenu={renderMenu}
    />
  );
}
