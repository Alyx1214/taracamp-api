import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { getAllReservationsByStatus, deleteReservation, searchReservations } from "../../apis/reservationApi"; 

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

export default function Declined({ 
  searchQuery = "", 
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
  useEffect(() => {
    let cancelled = false;
    async function fetchDeclined() {
      try {
        setLoading(true);
        let res;
        const skip = (currentPage - 1) * itemsPerPage;
        const options = { limit: itemsPerPage, skip };
        
        if (String(searchQuery || '').trim()) {
          const s = String(searchQuery || '').trim();
          res = await searchReservations({ query: s, ...options });
          res.reservations = (res?.reservations || []).filter(r => r.status === 'Declined');
        } else {
          res = await getAllReservationsByStatus("Declined", options);
        }
        const list = (res?.reservations || []).map(r => ({
          id: r._id || "N/A",
          name: r.guestName || "N/A",
          email: r.guestEmail || "N/A",
          serviceType: prettifyServiceType(r.serviceType) || "N/A",
          facilityName: r.facilityName || "N/A",
          date: formatDateLong(r.dateOfArrival || r.createdAt),
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
    fetchDeclined();
    return () => { cancelled = true; };
  }, [searchQuery, currentPage]);

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

  const handleDelete = async (row) => {
    if (!window.confirm(`Are you sure you want to delete reservation for ${row.name}?`)) return;
    try {
      await deleteReservation(row.id);
      setRows(prev => prev.filter(r => r.id !== row.id));
      alert("Reservation deleted!");
    } catch (e) {
      alert(e?.message || "Failed to delete reservation.");
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (parentOnPageChange) {
      parentOnPageChange(page);
    }
  };

  const renderActions = (row) => (
    <>
      <button className={styles["univ-decline-btn"]} onClick={() => handleDelete(row)}>
        Delete
      </button>
    </>
  );

  const renderMenu = (row) => [
    {
      label: "View Details",
      onClick: () => {
        if (!row.id || row.id === "N/A") {
          alert("Invalid reservation ID. Cannot view details.");
          return;
        }
        navigate(`/declinedRSV/${row.id}/details`);
      },
    },
  ];

  if (err) {
    return <div style={{ padding: 16 }}>Couldn’t load declined reservations: {err}</div>;
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
