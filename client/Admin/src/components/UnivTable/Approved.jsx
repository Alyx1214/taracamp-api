import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UnivTable from "./UnivTable";
import styles from "./UnivTable.module.css";
import { getAllReservationsByStatus, cancelReservation, searchReservations } from "../../apis/reservationApi"; // ← fix path if different

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
  const [cancellingId, setCancellingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(parentCurrentPage);
  const [totalPages, setTotalPages] = useState(parentTotalPages);
  const [totalItems, setTotalItems] = useState(parentTotalItems);

  const itemsPerPage = 15;
  const columns = useMemo(() => ["Name", "Email", "Service Type", "Facility Name", "Date", "Actions"], []);
  useEffect(() => {
    let cancelled = false;

    async function fetchApproved() {
      try {
        setLoading(true);
        let res;
        const skip = (currentPage - 1) * itemsPerPage;
        const options = { limit: itemsPerPage, skip };
        
        if (String(searchQuery || '').trim()) {
          const s = String(searchQuery || '').trim();
          res = await searchReservations({ query: s, ...options });
          res.reservations = (res?.reservations || []).filter(r => r.status === 'Approved');
        } else {
          res = await getAllReservationsByStatus("Approved", options); 
        }
        const list = (res?.reservations || []).map(r => ({
          id: r._id || "N/A",
          name: r.guestName || "N/A",
          email: r.guestEmail || "N/A",
          serviceType: prettifyServiceType(r.serviceType) || "N/A",
          facilityName: r.facilityName || "N/A",
          date: formatDateYMDToLong(r.dateOfArrival || r.createdAt),
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

    fetchApproved();
    return () => {
      cancelled = true;
    };
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

  const handleCancel = async (row) => {
    if (!window.confirm("Are you sure you want to cancel this reservation?")) return;
    try {
      setCancellingId(row.id); 
      await cancelReservation(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      alert(e?.message || "Failed to cancel reservation.");
    } finally {
      setCancellingId(null);
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
      <button className={styles["univ-approve-btn"]} onClick={() => navigate(`/reservations/${row.id}/edit`)}>
        Edit
      </button>
      <button
      className={styles["univ-decline-btn"]}
      disabled={cancellingId === row.id}
      onClick={() => handleCancel(row)}
    >
      {cancellingId === row.id ? "Cancelling..." : "Cancel"}
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
        navigate(`/approvedRSV/${row.id}/details`);
      },
    },
  ];

  if (err) {
    return <div style={{ padding: 16 }}>Couldn’t load approved reservations: {err}</div>;
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
