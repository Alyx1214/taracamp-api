import { useEffect, useMemo, useState } from 'react';
import styles from './ReservationsCalendar.module.css';
import { getReservationsForCalendar } from '../../apis/dashboardApi';
import { getAllFacilities } from '../../apis/facilityApi';

const monthsFull = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const ReservationsCalendar = () => {
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [dayCounts, setDayCounts] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [unavailableDates, setUnavailableDates] = useState(new Set()); // Track unavailable dates for selected facility
  const [reservedDates, setReservedDates] = useState(new Set()); // Track all dates with reservations (arrival to departure)

  // new UI state for search and facility filter
  const [searchQuery, setSearchQuery] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("All");
  const [facilities, setFacilities] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();   
  const monthForApi = monthIndex + 1;         

  const getDaysInMonthGrid = (date) => {
    const y = date.getFullYear();
    const m = date.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const daysInMonth = lastDay.getDate();
    // Monday-start grid: convert Sunday=0..Saturday=6 to Monday=0..Sunday=6
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

    const cells = [];
    for (let i = 0; i < startingDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  const daysGrid = useMemo(() => getDaysInMonthGrid(currentDate), [currentDate]);

  // Fetch all facilities once on mount (only if not already loaded)
  useEffect(() => {
    // Skip if facilities are already loaded
    if (facilities.length > 1) return;
    
    let cancelled = false;
    const fetchAllFacilities = async () => {
      try {
        // Helper function to extract facilities from response
        const extractFacilitiesFromResponse = (res) => {
          if (Array.isArray(res)) {
            return res;
          } else if (Array.isArray(res?.facilities)) {
            return res.facilities;
          } else if (Array.isArray(res?.data?.facilities)) {
            return res.data.facilities;
          } else if (res?.status === 200 && Array.isArray(res?.facilities)) {
            return res.facilities;
          } else if (res && typeof res === 'object') {
            // Try to find any array property (fallback)
            for (const key in res) {
              if (Array.isArray(res[key]) && res[key].length > 0) {
                return res[key];
              }
            }
          }
          return [];
        };
        
        // Fetch all facilities with pagination support
        // API has max limit of 100, so we need to fetch in batches if there are more
        let allFacilitiesData = [];
        let skip = 0;
        const limit = 100; // Max limit per request
        let hasMore = true;
        
        while (hasMore && !cancelled) {
          const res = await getAllFacilities({ limit, skip });
          if (cancelled) return;
          
          const facilitiesData = extractFacilitiesFromResponse(res);
          allFacilitiesData = [...allFacilitiesData, ...facilitiesData];
          
          // Check if there are more facilities to fetch
          const pagination = res?.pagination || {};
          const totalCount = pagination.totalCount || 0;
          const currentCount = allFacilitiesData.length;
          
          hasMore = currentCount < totalCount && facilitiesData.length === limit;
          skip += limit;
          
          // Safety check to prevent infinite loops
          if (skip > 10000) {
            console.warn('Reached maximum skip limit, stopping pagination');
            break;
          }
        }
        
        if (cancelled) return;
        
        // Log for debugging
        if (allFacilitiesData.length > 0) {
          console.log(`Fetched ${allFacilitiesData.length} facilities total`);
          // Log first few facilities to see their structure
          console.log('Sample facilities from API:', allFacilitiesData.slice(0, 3).map(f => ({
            name: f.name,
            facilityType: f.facilityType,
            keys: Object.keys(f)
          })));
        } else {
          console.warn('No facilities found in API response');
        }
        
        // Extract facility names from the facilities data
        // Handle all facility types including cottages, dormitories, and conference rooms
        // Exclude facilities where facilityName is null
        const facilityNames = allFacilitiesData
          .map((f, index) => {
            if (!f || typeof f !== 'object') {
              console.warn(`Facility at index ${index} is not an object:`, f);
              return null;
            }
            // Exclude facilities where facilityName is explicitly null
            if (f.facilityName === null) {
              return null;
            }
            // Try multiple possible name fields
            const name = f.name || f.facilityName || f.facility?.name || f.facility?.facilityName;
            if (!name || name === null) {
              // Log facility structure if name is missing (for debugging)
              console.warn(`Facility at index ${index} has no name field. Keys:`, Object.keys(f), 'Facility:', f);
              return null;
            }
            const nameStr = String(name).trim();
            return nameStr !== '' ? nameStr : null;
          })
          .filter(Boolean)
          .filter(name => name !== '');
        
        // Log facility types found for debugging
        if (allFacilitiesData.length > 0 && !cancelled) {
          const facilityTypes = allFacilitiesData
            .map(f => f.facilityType || f.type || 'unknown')
            .filter(Boolean);
          const uniqueTypes = Array.from(new Set(facilityTypes));
          console.log('Facility types found:', uniqueTypes, 'Total facilities:', allFacilitiesData.length);
          console.log('Facility names extracted:', facilityNames.length, 'out of', allFacilitiesData.length);
        }
        
        // Remove duplicates and sort
        const uniqueNames = Array.from(new Set(facilityNames)).sort();
        
        if (uniqueNames.length > 0 && !cancelled) {
          setFacilities(["All", ...uniqueNames]);
        } else if (!cancelled && allFacilitiesData.length > 0) {
          // Log if we got facilities but couldn't extract names (for debugging)
          console.warn('Got facilities data but could not extract names:', allFacilitiesData.slice(0, 3));
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Error loading facilities:', e);
        }
        // Facilities list will remain empty if API call fails
      }
    };
    fetchAllFacilities();
    return () => {
      cancelled = true;
    };
  }, [facilities.length]);

  useEffect(() => {
    let cancelled = false;
    const fetchMonth = async () => {
      setLoading(true);
      try {
        const res = await getReservationsForCalendar(year, monthForApi);
        if (cancelled) return;
        
        const rows = Array.isArray(res?.reservations) ? res.reservations : [];

        // Note: Facilities are now fetched from getAllFacilities API only
        // No longer building facilities from reservations - use the facilities state from getAllFacilities

        const map = new Map();
        const q = (searchQuery || "").trim().toLowerCase();
        
        // Helper function to parse date strings
        const parseDateOnly = (dateStr) => {
          if (!dateStr) return null;
          try {
            // Extract just the date part (YYYY-MM-DD) from ISO string
            const datePart = String(dateStr).split('T')[0].split(' ')[0];
            const parts = datePart.split('-');
            
            if (parts.length === 3) {
              const year = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              const day = parseInt(parts[2], 10);
              
              if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                // Create date in local timezone using Date constructor
                // This avoids timezone conversion issues
                return new Date(year, month - 1, day, 12, 0, 0, 0); // Use noon to avoid DST issues
              }
            }
          } catch (e) {
            console.warn('Error parsing date:', dateStr, e);
          }
          // Fallback: try regular Date parsing but extract date components
          const fallback = new Date(dateStr);
          if (!isNaN(fallback.getTime())) {
            // Extract date components from the parsed date
            // Use UTC methods to avoid timezone shifts
            const year = fallback.getUTCFullYear();
            const month = fallback.getUTCMonth();
            const day = fallback.getUTCDate();
            return new Date(year, month, day, 12, 0, 0, 0);
          }
          return null;
        };
        
        // Helper function to add all dates in a range to a set
        const addDateRangeToSet = (arrivalDate, departureDate, targetSet) => {
          if (!arrivalDate || !departureDate || 
              Number.isNaN(arrivalDate.getTime()) || 
              Number.isNaN(departureDate.getTime())) {
            return;
          }
          
          const startYear = arrivalDate.getFullYear();
          const startMonth = arrivalDate.getMonth();
          const startDay = arrivalDate.getDate();
          
          const endYear = departureDate.getFullYear();
          const endMonth = departureDate.getMonth();
          const endDay = departureDate.getDate();
          
          let currentYear = startYear;
          let currentMonth = startMonth;
          let currentDay = startDay;
          
          while (true) {
            // Check if this date is in the current month being displayed
            if (currentMonth === monthIndex && currentYear === year) {
              targetSet.add(currentDay);
            }
            
            // Check if we've reached the end date (inclusive)
            if (currentYear === endYear && currentMonth === endMonth && currentDay === endDay) {
              break;
            }
            
            // Check if we've passed the end date
            if (currentYear > endYear || 
                (currentYear === endYear && currentMonth > endMonth) ||
                (currentYear === endYear && currentMonth === endMonth && currentDay > endDay)) {
              break;
            }
            
            // Move to next day
            currentDay++;
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            if (currentDay > daysInMonth) {
              currentDay = 1;
              currentMonth++;
              if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
              }
            }
          }
        };
        
        // First pass: Track ALL dates with reservations (for red highlighting)
        // Exclude cancelled and declined reservations
        const allReservedDates = new Set();
        for (const r of rows) {
          // Skip cancelled and declined reservations
          const status = String(r.status || '').toLowerCase();
          if (status.includes('cancel') || status.includes('decline')) {
            continue;
          }
          
          const arrivalDate = parseDateOnly(r.dateOfArrival);
          const departureDate = r.dateOfDeparture ? parseDateOnly(r.dateOfDeparture) : arrivalDate;
          
          if (arrivalDate && departureDate) {
            addDateRangeToSet(arrivalDate, departureDate, allReservedDates);
          }
        }
        
        // Determine the target facility from filter or search (use current facilities state)
        let targetFacility = null;
        if (facilityFilter !== "All") {
          targetFacility = facilityFilter;
        } else if (q && facilities.length > 1) {
          // Find facility that matches search query (case-insensitive, partial match)
          // Only search if facilities are loaded
          const matchedFacility = facilities.find(f => {
            if (f === "All") return false;
            const facilityName = String(f).toLowerCase().trim();
            return facilityName.includes(q) || q.includes(facilityName);
          });
          targetFacility = matchedFacility || null;
        }
        
        // Second pass: Track ALL dates with reservations for the target facility (for availability calculation)
        const bookedDatesForFacility = new Set();
        if (targetFacility) {
          for (const r of rows) {
            const rName =
              (r.facilityName && String(r.facilityName).trim()) ||
              (r.facility && (r.facility.name || r.facility.facilityName)) ||
              "";
            
            // Match facility name (case-insensitive, trim both sides)
            const rNameLower = String(rName).toLowerCase().trim();
            const targetFacilityLower = String(targetFacility).toLowerCase().trim();
            
            if (rNameLower === targetFacilityLower) {
              // Skip cancelled reservations
              const status = String(r.status || '').toLowerCase();
              if (status.includes('cancel')) {
                continue;
              }
              
              // Get arrival and departure dates
              const arrivalDate = parseDateOnly(r.dateOfArrival);
              const departureDate = r.dateOfDeparture ? parseDateOnly(r.dateOfDeparture) : arrivalDate;
              
              if (arrivalDate && departureDate) {
                addDateRangeToSet(arrivalDate, departureDate, bookedDatesForFacility);
              }
            }
          }
        }

        // Second pass: Build the filtered map for display
        for (const r of rows) {
          // apply facility filter if selected
          const rName =
            (r.facilityName && String(r.facilityName).trim()) ||
            (r.facility && (r.facility.name || r.facility.facilityName)) ||
            "";

          if (facilityFilter && facilityFilter !== "All" && String(rName) !== String(facilityFilter)) {
            continue;
          }

          // apply search query (search facility name and guest name if available)
          if (q) {
            const guest =
              (r.guestName && String(r.guestName)) ||
              (r.guest && (r.guest.name || r.guest.fullName)) ||
              "";
            const hay = `${rName} ${guest}`.toLowerCase();
            if (!hay.includes(q)) continue;
          }

          // Use parseDateOnly to avoid timezone issues (same as reserved dates)
          const arrivalDate = parseDateOnly(r.dateOfArrival);
          if (!arrivalDate || Number.isNaN(arrivalDate.getTime())) continue;
          
          // Only count if the arrival date is in the current month being displayed
          if (arrivalDate.getFullYear() === year && arrivalDate.getMonth() === monthIndex) {
            const day = arrivalDate.getDate();

            const prev = map.get(day) || { total: 0, cancelled: 0, confirmed: 0, pending: 0, checkin: 0, checkout: 0 };
            prev.total += 1;

            const status = String(r.status || '').toLowerCase();
            if (status.includes('cancel')) prev.cancelled += 1;
            else if (status.includes('confirm')) prev.confirmed += 1;
            else if (status.includes('pending')) prev.pending += 1;
            else if (status.includes('checkin')) prev.checkin += 1;
            else if (status.includes('checkout')) prev.checkout += 1;

            map.set(day, prev);
          }
        }
        setDayCounts(map);
        
        // Set all reserved dates (for red highlighting of all reservation ranges)
        // Always show all reserved dates in red, regardless of facility selection
        if (!cancelled) {
          setReservedDates(allReservedDates);
        }
        
        // Calculate unavailable dates for the selected facility
        if (targetFacility) {
          const unavailable = new Set(bookedDatesForFacility);
          
          if (!cancelled) {
            setUnavailableDates(unavailable);
          }
        } else {
          // When no facility selected, use all reserved dates as unavailable
          if (!cancelled) {
            setUnavailableDates(allReservedDates);
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Error loading reservations for calendar:', e);
          setDayCounts(new Map());
          setReservedDates(new Set());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchMonth();
    return () => {
      cancelled = true;
    };
  }, [year, monthForApi, facilityFilter, searchQuery, facilities]);

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(prev.getMonth() + direction);
      return d;
    });
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      monthIndex === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  return (
    <div className={styles.calendarContainer}>
      <div className={styles.calendarHeader}>
        <div className={styles.headerTop}>
          <h3 className={styles.calendarTitle}>Reservations Calendar</h3>
        </div>

        {/* search + facility dropdown inserted between title and header controls */}
        <div className={styles.searchRow}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="search"
              placeholder="Search facility name..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                setShowSearchSuggestions(value.trim().length > 0);
                // Clear facility filter when searching
                if (value.trim()) {
                  setFacilityFilter("All");
                }
              }}
              onFocus={() => {
                if (searchQuery.trim().length > 0) {
                  setShowSearchSuggestions(true);
                }
              }}
              onBlur={() => {
                // Delay hiding suggestions to allow clicking on them
                setTimeout(() => setShowSearchSuggestions(false), 200);
              }}
              aria-label="Search facility"
            />
            {showSearchSuggestions && facilities.length > 1 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '2px solid #174226',
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                {facilities
                  .filter(f => f !== "All" && String(f).toLowerCase().includes(searchQuery.trim().toLowerCase()))
                  .map((f) => (
                    <div
                      key={f}
                      onClick={() => {
                        setSearchQuery(f);
                        setFacilityFilter("All");
                        setShowSearchSuggestions(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #e5e7eb'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f6faf7'}
                      onMouseLeave={(e) => e.target.style.background = 'white'}
                    >
                      {f}
                    </div>
                  ))}
                {facilities.filter(f => f !== "All" && String(f).toLowerCase().includes(searchQuery.trim().toLowerCase())).length === 0 && (
                  <div style={{ padding: '8px 12px', color: '#6b7280', fontStyle: 'italic' }}>
                    No facilities found
                  </div>
                )}
              </div>
            )}
          </div>

          <select
            className={styles.filterSelect}
            value={facilityFilter}
            onChange={(e) => {
              setFacilityFilter(e.target.value);
              // Clear search when selecting from dropdown
              if (e.target.value !== "All") {
                setSearchQuery("");
                setShowSearchSuggestions(false);
              }
            }}
            aria-label="Filter by facility"
          >
            {facilities.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        
        {/* Show which facility is selected for availability */}
        {(() => {
          const q = (searchQuery || "").trim().toLowerCase();
          let targetFacility = null;
          if (facilityFilter !== "All") {
            targetFacility = facilityFilter;
          } else if (q) {
            const matchedFacility = facilities.find(f => {
              if (f === "All") return false;
              const facilityName = String(f).toLowerCase().trim();
              return facilityName.includes(q) || q.includes(facilityName);
            });
            targetFacility = matchedFacility || null;
          }
          return targetFacility ? (
            <div style={{ padding: '8px 0', color: '#15803d', fontWeight: 600, fontSize: '14px' }}>
              Showing unavailable dates for: <strong>{targetFacility}</strong>
            </div>
          ) : null;
        })()}

        <div className={styles.headerControls}>
          <span className={styles.monthYear}>
            {monthsFull[monthIndex]} {year}
          </span>
          <div className={styles.monthNavigation}>
            <button
              className={styles.navButton}
              onClick={() => navigateMonth(-1)}
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              className={styles.navButton}
              onClick={() => navigateMonth(1)}
              aria-label="Next month"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {loading && <div style={{ padding: '8px 0', color: '#666' }}>Loading…</div>}

      <div className={styles.calendar}>
        <div className={styles.weekdaysHeader}>
          {weekdays.map(d => (
            <div key={d} className={styles.weekday}>{d}</div>
          ))}
        </div>

        <div className={styles.daysGrid}>
          {daysGrid.map((day, idx) => {
            const counts = day ? dayCounts.get(day) : null;
            const hasAny = !!(counts && counts.total > 0);
            const isUnavailable = day && unavailableDates.has(day);
            const isReserved = day && reservedDates.has(day);
            const q = (searchQuery || "").trim().toLowerCase();
            let targetFacility = null;
            if (facilityFilter !== "All") {
              targetFacility = facilityFilter;
            } else if (q) {
              const matchedFacility = facilities.find(f => {
                if (f === "All") return false;
                const facilityName = String(f).toLowerCase().trim();
                return facilityName.includes(q) || q.includes(facilityName);
              });
              targetFacility = matchedFacility || null;
            }
            // Show red for unavailable dates:
            // - If no facility selected: show all reserved dates (isReserved)
            // - If facility selected: show unavailable dates for that facility (isUnavailable)
            const showUnavailable = targetFacility 
              ? (isUnavailable && unavailableDates.size > 0)
              : (isReserved && reservedDates.size > 0);
            // Show green for available dates (dates that are not unavailable)
            const showAvailable = day && !showUnavailable;
            
            return (
              <div
                key={idx}
                className={`${styles.dayCell} ${day ? styles.hasDay : styles.emptyDay} ${isToday(day) ? styles.today : ''} ${showAvailable ? styles.available : ''} ${showUnavailable ? styles.unavailable : ''}`}
                title={counts ? `Total: ${counts.total} — Confirmed: ${counts.confirmed}, Cancelled: ${counts.cancelled}` : showUnavailable ? (isReserved ? 'Reserved' : 'Unavailable (Booked)') : showAvailable ? 'Available' : undefined}
              >
                {day ?? ''}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ReservationsCalendar;
