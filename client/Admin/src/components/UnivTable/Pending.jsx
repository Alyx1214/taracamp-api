import React, { useEffect, useMemo, useState } from "react";
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
  onPaginationUpdate
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

  const itemsPerPage = 15;
  const columns = useMemo(() => ["Name", "Email", "Service Type", "Facility Name", "Date", "Actions"], []);

  useEffect(() => {
    let cancelled = false;

    async function fetchPending() {
      try {
        setLoading(true);
        let res;
        const skip = (currentPage - 1) * itemsPerPage;
        const options = { limit: itemsPerPage, skip };

        // Fetch pending reservations or search results
        if (String(searchQuery || '').trim()) {
          const s = String(searchQuery || '').trim();
          res = await searchReservations({ query: s, ...options });
          res.reservations = (res?.reservations || []).filter(r => r.status === 'Pending');
        } else {
          res = await getAllReservationsByStatus("Pending", options);
        }

        const reservations = res?.reservations || [];

        // 🔹 Fetch facility names in parallel
        const list = await Promise.all(
          reservations.map(async (r) => {
            let facilityName = "N/A";
            try {
              if (r.facility) {
                const facilityData = await getFacilityById(r.facility);
                facilityName = facilityData?.facility?.name || "N/A";
              }
            } catch {
              facilityName = "N/A";
            }

            return {
              id: r._id || "N/A",
              name: r.guestName || "N/A",
              email: r.guestEmail || "N/A",
              serviceType: prettifyServiceType(r.serviceType) || "N/A",
              facilityName,
              date: formatDateYMDToLong(r.dateOfArrival || r.createdAt),
              _raw: r,
            };
          })
        );

        if (!cancelled) {
          setRows(list);
          const totalCount = res?.totalCount || 0;
          setTotalItems(totalCount);
          setTotalPages(Math.ceil(totalCount / itemsPerPage));

          if (onPaginationUpdate) {
            onPaginationUpdate(Math.ceil(totalCount / itemsPerPage), totalCount);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load reservations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPending();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, currentPage]);

  useEffect(() => setCurrentPage(parentCurrentPage), [parentCurrentPage]);
  useEffect(() => setTotalPages(parentTotalPages), [parentTotalPages]);
  useEffect(() => setTotalItems(parentTotalItems), [parentTotalItems]);

  async function onApprove(row) {
    try {
      await decideReservation(row.id, "Approved");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
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
      setRows((prev) => prev.filter((r) => r.id !== selectedRow.id));
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

  const renderActions = (row) => (
    <>
      <button className={styles["univ-approve-btn"]} onClick={() => onApprove(row)}>Approve</button>
      <button className={styles["univ-decline-btn"]} onClick={() => promptDecline(row)}>Decline</button>
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
        navigate(`/pendingRSV/${row.id}/details`);
      },
    },
  ];

  if (err) {
    return <div style={{ padding: 16 }}>Couldn’t load pending reservations: {err}</div>;
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