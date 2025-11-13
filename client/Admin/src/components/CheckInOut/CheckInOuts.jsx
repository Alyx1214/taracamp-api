import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import styles from "./CheckInOuts.module.css";
import CheckTabs from "./CheckTabs";
import CheckHead from "./CheckHead";
import UnivTable from "../UnivTable/UnivTable"; 
import SearchFil from "../SearchFil/SearchFil";
import ConfirmModal from "../Shared/ConfirmModal";
import { searchReservations, checkInOrCheckOutReservation, deleteReservation } from "../../apis/reservationApi";

export default function CheckInOuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeTab: stateActiveTab, filters: stateFilters } = location.state || {};
  
  const [activeTab, setActiveTab] = useState(stateActiveTab || "Confirmed");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState(stateFilters || {
    serviceType: "",
    facilityType: "",
    startDate: "",
    endDate: "",
    sortBy: ""
  });

  // Dynamic columns based on active tab
  const getColumns = () => {
    if (activeTab === "Check-in" || activeTab === "Check-out") {
      return ["Name", "Email", "Service Type", "Facility Type", "Departure Date", "Actions"];
    }
    return ["Name", "Email", "Service Type", "Facility Type", "Arrival Date", "Actions"];
  };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const cancelledRef = useRef(false);

  const statusForTab = (tab) => {
    if (tab === "Confirmed") return "Confirmed"; 
    if (tab === "Check-in") return "Checked-in";
    if (tab === "Check-out") return "Checked-out";
    return "";
  };

  const formatDateYMDToLong = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  };

  const prettifyServiceType = (svc) => {
    if (!svc) return "N/A";
    return String(svc)
      .split(/([\/\s])/)
      .map((w) => (w.match(/[a-z]/i) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
      .join("");
  };

  const getFacilityType = (reservation) => {
    // Extract facility type from reservation object (set by server)
    if (reservation.facilityType) {
      return prettifyServiceType(reservation.facilityType);
    }
    return "N/A";
  };

  // Reset filters and search when active tab changes
  useEffect(() => {
    setFilters({
      serviceType: "",
      facilityType: "",
      startDate: "",
      endDate: "",
      sortBy: ""
    });
    setSearchQuery("");
  }, [activeTab]);

  useEffect(() => {
    cancelledRef.current = false;
    async function load() {
      try {
        setLoading(true);
        setErr(null);
        const status = statusForTab(activeTab);
        if (!status) { 
          if (!cancelledRef.current) setRows([]); 
          return; 
        }
        
        const params = { status };
        
        // Determine which date field to filter by based on active tab
        if (activeTab === "Check-in" || activeTab === "Check-out") {
          params.dateField = "dateOfDeparture";
        } else {
          params.dateField = "dateOfArrival";
        }
        
        // Apply service type filter
        if (filters.serviceType) {
          params.serviceType = filters.serviceType;
        }
        
        // Apply facility type filter
        if (filters.facilityType) {
          params.facilityType = filters.facilityType;
        }
        
        // Apply date range filter
        if (filters.startDate) {
          params.start = filters.startDate;
        }
        if (filters.endDate) {
          params.end = filters.endDate;
        }
        
        // Apply sorting
        if (filters.sortBy) {
          params.sort = filters.sortBy;
        }
        
        // Apply search query
        if (searchQuery && searchQuery.trim()) {
          params.query = searchQuery.trim();
        }
        
        const res = await searchReservations(params);
        
        // Check if component was unmounted before updating state
        if (cancelledRef.current) return;
        
        let list = (res?.reservations || []).map((r) => {
          const baseData = {
            id: r._id || "",
            name: r.guestName || "N/A",
            email: r.guestEmail || "N/A",
            serviceType: prettifyServiceType(r.serviceType) || "N/A",
            facilityType: getFacilityType(r),
            guestType: r.guestType || "INDIVIDUAL",
            _raw: r,
          };

          // Use departure date for Check-in and Check-out tabs, arrival date for Confirmed
          if (activeTab === "Check-in" || activeTab === "Check-out") {
            return {
              ...baseData,
              departureDate: formatDateYMDToLong(r.dateOfDeparture),
            };
          } else {
            return {
              ...baseData,
              arrivalDate: formatDateYMDToLong(r.dateOfArrival),
            };
          }
        });
        
        // Apply client-side sorting if needed
        if (filters.sortBy) {
          list = applySorting(list, filters.sortBy);
        }
        
        if (!cancelledRef.current) setRows(list);
      } catch (e) {
        if (!cancelledRef.current) setErr(e?.data?.error || e?.message || "Failed to load reservations");
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    }
    load();
    return () => { 
      cancelledRef.current = true; 
    };
  }, [activeTab, filters, searchQuery]);

  const applySorting = (data, sortBy) => {
    const sorted = [...data];
    switch (sortBy) {
      case "name-asc":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case "date-asc":
        return sorted.sort((a, b) => {
          const dateA = new Date((activeTab === "Check-in" || activeTab === "Check-out") ? a._raw?.dateOfDeparture : a._raw?.dateOfArrival);
          const dateB = new Date((activeTab === "Check-in" || activeTab === "Check-out") ? b._raw?.dateOfDeparture : b._raw?.dateOfArrival);
          return dateA - dateB;
        });
      case "date-desc":
        return sorted.sort((a, b) => {
          const dateA = new Date((activeTab === "Check-in" || activeTab === "Check-out") ? a._raw?.dateOfDeparture : a._raw?.dateOfArrival);
          const dateB = new Date((activeTab === "Check-in" || activeTab === "Check-out") ? b._raw?.dateOfDeparture : b._raw?.dateOfArrival);
          return dateB - dateA;
        });
      case "service-asc":
        return sorted.sort((a, b) => a.serviceType.localeCompare(b.serviceType));
      case "service-desc":
        return sorted.sort((a, b) => b.serviceType.localeCompare(a.serviceType));
      case "facility-asc":
        return sorted.sort((a, b) => a.facilityType.localeCompare(b.facilityType));
      case "facility-desc":
        return sorted.sort((a, b) => b.facilityType.localeCompare(a.facilityType));
      default:
        return sorted;
    }
  };

  const renderMenu = (row) => [
    { 
      label: "View", 
      onClick: () => {
        if (!row.id || row.id === "N/A") {
          alert("Invalid reservation ID. Cannot view details.");
          return;
        }
        row.guestType === "GROUP"
          ? navigate(`/confirmedGroup/${row.id}/details`, {
              state: {
                fromCheckInOut: true,
                activeTab: activeTab,
                filters,
              }
            })
          : navigate(`/confirmedIndiv/${row.id}/details`, {
              state: {
                fromCheckInOut: true,
                activeTab: activeTab,
                filters,
              }
            });
      }
    },
    { 
      label: "Edit", 
      onClick: () => {
        if (!row.id || row.id === "N/A") {
          alert("Invalid reservation ID. Cannot edit.");
          return;
        }
        navigate(`/reservations/${row.id}/edit`, {
          state: {
            fromCheckInOut: true,
            activeTab: activeTab,
            filters,
          }
        });
      }
    },
  ];

  const [actionId, setActionId] = useState(null);
  const [confirmCheckInOpen, setConfirmCheckInOpen] = useState(false);
  const [confirmCheckOutOpen, setConfirmCheckOutOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const promptCheckIn = (row) => {
    setSelectedRow(row);
    setConfirmCheckInOpen(true);
  };

  const promptCheckOut = (row) => {
    setSelectedRow(row);
    setConfirmCheckOutOpen(true);
  };

  const confirmCheckIn = async () => {
    if (!selectedRow) return;
    try {
      setCheckingIn(true);
      await doAction(selectedRow, "Checked-in");
      setConfirmCheckInOpen(false);
      setSelectedRow(null);
    } catch (e) {
      alert(e?.data?.error || e?.message || 'Failed to check-in reservation');
    } finally {
      setCheckingIn(false);
    }
  };

  const confirmCheckOut = async () => {
    if (!selectedRow) return;
    try {
      setCheckingOut(true);
      await doAction(selectedRow, "Checked-out");
      setConfirmCheckOutOpen(false);
      setSelectedRow(null);
    } catch (e) {
      alert(e?.data?.error || e?.message || 'Failed to check-out reservation');
    } finally {
      setCheckingOut(false);
    }
  };

  const doAction = async (row, nextStatus) => {
    try {
      setActionId(row.id);
      await checkInOrCheckOutReservation(row.id, nextStatus);
      // Refresh with current filters
      const status = statusForTab(activeTab);
      const params = { status };
      // Determine which date field to filter by based on active tab
      if (activeTab === "Check-in" || activeTab === "Check-out") {
        params.dateField = "dateOfDeparture";
      } else {
        params.dateField = "dateOfArrival";
      }
      if (filters.serviceType) params.serviceType = filters.serviceType;
      if (filters.facilityType) params.facilityType = filters.facilityType;
      if (filters.startDate) params.start = filters.startDate;
      if (filters.endDate) params.end = filters.endDate;
      if (filters.sortBy) params.sort = filters.sortBy;
      if (searchQuery && searchQuery.trim()) params.query = searchQuery.trim();
      
      const res = await searchReservations(params);
      let list = (res?.reservations || []).map((r) => {
        const baseData = {
          id: r._id || "",
          name: r.guestName || "N/A",
          email: r.guestEmail || "N/A",
          serviceType: prettifyServiceType(r.serviceType) || "N/A",
          facilityType: getFacilityType(r),
          guestType: r.guestType || "INDIVIDUAL",
          _raw: r,
        };

        if (activeTab === "Check-in" || activeTab === "Check-out") {
          return {
            ...baseData,
            departureDate: formatDateYMDToLong(r.dateOfDeparture),
          };
        } else {
          return {
            ...baseData,
            arrivalDate: formatDateYMDToLong(r.dateOfArrival),
          };
        }
      });
      
      if (filters.sortBy) {
        list = applySorting(list, filters.sortBy);
      }
      
      setRows(list);
    } catch (e) {
      alert(e?.data?.error || e?.message || 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  const renderApprovedActions = (row) => (
    <>
      <button
        className={`${styles.pillBtn} ${styles.editBtn}`}
        onClick={() => {
          if (!row.id || row.id === "N/A") {
            alert("Invalid reservation ID. Cannot edit.");
            return;
          }
          navigate(`/reservations/${row.id}/edit`, {
            state: {
              fromCheckInOut: true,
              activeTab: activeTab,
              filters,
            }
          });
        }}
      >
        Edit
      </button>
      <button
        className={`${styles.pillBtn} ${styles.checkInBtn}`}
        disabled={actionId === row.id || checkingIn}
        onClick={() => promptCheckIn(row)}
        style={{ marginLeft: 8 }}
      >
        {actionId === row.id && checkingIn ? 'Checking In...' : 'Check-In'}
      </button>
    </>
  );

  const renderCheckInActions = (row) => (
    <>
      <button
        className={`${styles.pillBtn} ${styles.editBtn}`}
        onClick={() => {
          if (!row.id || row.id === "N/A") {
            alert("Invalid reservation ID. Cannot edit.");
            return;
          }
          navigate(`/reservations/${row.id}/edit`, {
            state: {
              fromCheckInOut: true,
              activeTab: activeTab,
              filters,
            }
          });
        }}
      >
        Edit
      </button>
      <button
        className={`${styles.pillBtn} ${styles.checkOutBtn}`}
        disabled={actionId === row.id || checkingOut}
        onClick={() => promptCheckOut(row)}
        style={{ marginLeft: 8 }}
      >
        {actionId === row.id && checkingOut ? 'Checking Out...' : 'Check-Out'}
      </button>
    </>
  );

  const renderCheckOutActions = (row) => (
    <DeleteButton row={row} />
  );

  const [deleteId, setDeleteId] = useState(null);

  const handleDelete = async (row) => {
    if (!window.confirm('Are you sure you want to delete this reservation?')) return;
    try {
      setDeleteId(row.id);
      await deleteReservation(row.id);
      // Refresh current tab with filters after delete
      const status = statusForTab(activeTab);
      const params = { status };
      // Determine which date field to filter by based on active tab
      if (activeTab === "Check-in" || activeTab === "Check-out") {
        params.dateField = "dateOfDeparture";
      } else {
        params.dateField = "dateOfArrival";
      }
      if (filters.serviceType) params.serviceType = filters.serviceType;
      if (filters.facilityType) params.facilityType = filters.facilityType;
      if (filters.startDate) params.start = filters.startDate;
      if (filters.endDate) params.end = filters.endDate;
      if (filters.sortBy) params.sort = filters.sortBy;
      if (searchQuery && searchQuery.trim()) params.query = searchQuery.trim();
      
      const res = await searchReservations(params);
      let list = (res?.reservations || []).map((r) => {
        const baseData = {
          id: r._id || "",
          name: r.guestName || "N/A",
          email: r.guestEmail || "N/A",
          serviceType: prettifyServiceType(r.serviceType) || "N/A",
          facilityType: getFacilityType(r),
          guestType: r.guestType || "INDIVIDUAL",
          _raw: r,
        };

        if (activeTab === "Check-in" || activeTab === "Check-out") {
          return {
            ...baseData,
            departureDate: formatDateYMDToLong(r.dateOfDeparture),
          };
        } else {
          return {
            ...baseData,
            arrivalDate: formatDateYMDToLong(r.dateOfArrival),
          };
        }
      });
      
      if (filters.sortBy) {
        list = applySorting(list, filters.sortBy);
      }
      
      setRows(list);
    } catch (e) {
      alert(e?.data?.error || e?.message || 'Failed to delete reservation');
    } finally {
      setDeleteId(null);
    }
  };

  const DeleteButton = ({ row }) => (
    <button
      className={`${styles.pillBtn} ${styles.deleteBtn}`}
      disabled={deleteId === row.id}
      onClick={() => handleDelete(row)}
    >
      {deleteId === row.id ? 'Deleting…' : 'Delete'}
    </button>
  );

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters || {});
  };

  const handleSearch = (query) => {
    setSearchQuery(query || "");
  };

  // Define filter fields based on the table columns
  const getFilterFields = () => {
    const dateLabel = (activeTab === "Check-in" || activeTab === "Check-out") ? "Departure Date" : "Arrival Date";
    
    return [
      {
        name: "serviceType",
        label: "Service Type",
        type: "select",
        options: [
          { value: "", label: "All Types" },
          { value: "Lodging", label: "Lodging" },
          { value: "Event", label: "Event" },
          { value: "Event and Lodging", label: "Event and Lodging" }
        ]
      },
      {
        name: "facilityType",
        label: "Facility Type",
        type: "select",
        options: [
          { value: "", label: "All Facilities" },
          { value: "Dormitory", label: "Dormitory" },
          { value: "Cottage", label: "Cottage" },
          { value: "Conference", label: "Conference" }
        ]
      },
      {
        name: "startDate",
        label: `${dateLabel} (From)`,
        type: "date"
      },
      {
        name: "endDate",
        label: `${dateLabel} (To)`,
        type: "date"
      },
      {
        name: "sortBy",
        label: "Sort By",
        type: "select",
        options: [
          { value: "", label: "None" },
          { value: "name-asc", label: "Name (A-Z)" },
          { value: "name-desc", label: "Name (Z-A)" },
          { value: "date-asc", label: `${dateLabel} (Earliest First)` },
          { value: "date-desc", label: `${dateLabel} (Latest First)` },
          { value: "service-asc", label: "Service Type (A-Z)" },
          { value: "service-desc", label: "Service Type (Z-A)" },
          { value: "facility-asc", label: "Facility Type (A-Z)" },
          { value: "facility-desc", label: "Facility Type (Z-A)" }
        ]
      }
    ];
  };

  // Server-side filtering; just render rows
  const getActiveData = () => rows;

  return (
    <div className={styles.container}>
      <CheckHead />

      <div className={styles.headerRow}>
        <CheckTabs value={activeTab} onChange={setActiveTab} />

        <SearchFil
          onSearch={handleSearch}
          onApplyFilters={handleApplyFilters}
          filterFields={getFilterFields()}
          initialSearchValue={searchQuery}
        />
      </div>

      <div className={styles.content}>
        {err && <div style={{ padding: 12, color: '#b00' }}>{String(err)}</div>}
        {activeTab === "Confirmed" && (
          <UnivTable
            columns={getColumns()}
            data={getActiveData()}
            renderActions={renderApprovedActions}
            renderMenu={renderMenu}
            loading={loading}
          />
        )}
        {activeTab === "Check-in" && (
          <UnivTable
            columns={getColumns()}
            data={getActiveData()}
            renderActions={renderCheckInActions}
            renderMenu={renderMenu}
            loading={loading}
          />
        )}
        {activeTab === "Check-out" && (
          <UnivTable
            columns={getColumns()}
            data={getActiveData()}
            renderActions={renderCheckOutActions}
            renderMenu={renderMenu}
            loading={loading}
          />
        )}
      </div>

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

      {/* Check-Out Confirmation Modal */}
      <ConfirmModal
        open={confirmCheckOutOpen}
        title="Check-Out Guest"
        message={`Are you sure you want to check-out ${selectedRow?.name || 'this guest'}? This will move them to the Check-Out tab and complete their reservation.`}
        confirmText="Check-Out"
        cancelText="Cancel"
        confirming={checkingOut}
        variant="success"
        onCancel={() => {
          setConfirmCheckOutOpen(false);
          setSelectedRow(null);
        }}
        onConfirm={confirmCheckOut}
      />
    </div>
  );
}