import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './ServiceDetail.module.css';
import placeholderImage from '../../assets/conference.jpg';
import Calendar from './Calendar';
import Reviews from './Reviews';
import { getFacilityById, getUnavailableDatesByFacility } from '../../apis/facilityApi';
import { getReviewsByFacilityId } from '../../apis/reviewsApi';

function isTokenExpired(token) {
  try {
    if (!token) return true;
    const [, payloadBase64] = token.split(".");
    if (!payloadBase64) return true;
    const payload = JSON.parse(atob(payloadBase64));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try {
      const token = localStorage.getItem('accessToken');
      return token && !isTokenExpired(token);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onStorage = () => {
      const token = localStorage.getItem('accessToken');
      setIsLoggedIn(token && !isTokenExpired(token));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { isLoggedIn };
};

function MainServicesServiceDetail() {
  const params = useParams();
  const { type, name, facilityName, id } = params;
  const facilityNameParam = name || facilityName;
  const location = useLocation();
  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [reservations, setReservations] = useState([]); // Initialize as empty array to avoid uninitialized variable errors
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [averageRatings, setAverageRatings] = useState({
    location: 0,
    service: 0,
    cleanliness: 0,
    overall: 0
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedArrivalDate, setSelectedArrivalDate] = useState('');
  const [selectedDepartureDate, setSelectedDepartureDate] = useState('');
  const [selectedDepartureDateDisplay, setSelectedDepartureDateDisplay] = useState(null);
  const [isSelectingDeparture, setIsSelectingDeparture] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [arrivalDateError, setArrivalDateError] = useState('');
  const [departureDateError, setDepartureDateError] = useState('');
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);
  const [unavailableDatesVersion, setUnavailableDatesVersion] = useState(0); // Version counter for useMemo dependency
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const hasValidatedDatesRef = useRef(false);
  
  // Use refs to store values for useMemo to avoid TDZ issues
  const availableDatesRef = useRef([]);
  const unavailableDatesRef = useRef([]);
  const facilityRef = useRef(null);
  const reservationsRef = useRef([]);
  
  // Update refs whenever values change
  useEffect(() => {
    availableDatesRef.current = availableDates;
  }, [availableDates]);
  
  useEffect(() => {
    unavailableDatesRef.current = unavailableDates;
    setUnavailableDatesVersion(prev => prev + 1);
  }, [unavailableDates]);
  
  useEffect(() => {
    facilityRef.current = facility;
  }, [facility]);
  
  useEffect(() => {
    reservationsRef.current = reservations;
  }, [reservations]);

  useEffect(() => {
    // Reset validation ref when facility ID changes
    hasValidatedDatesRef.current = false;

    const fetchFacilityData = async () => {
      if (!id) {
        console.error('No facility ID provided in route params');
        setError('No facility ID provided');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [facilityResponse, unavailableDatesResponse] = await Promise.all([
          getFacilityById(id),
          getUnavailableDatesByFacility(id)
        ]);

        let facilityType = null;
        if (facilityResponse.status === 200 && facilityResponse.facility) {
          const facilityData = facilityResponse.facility;
          facilityType = facilityData.facilityType;
          
          const transformedFacility = {
            id: facilityData._id || facilityData.id,
            name: facilityData.name || 'Unnamed Facility',
            facilityType: facilityData.facilityType || 'Unknown',
            capacity: facilityData.capacity || 0,
            ratePerPerson: facilityData.ratePerPerson || 0,
            price: facilityData.price || 0,
            status: facilityData.status || 'Available',
            image: facilityData.images?.[0] || placeholderImage,
            features: [
              { icon: '🏔️', title: 'Great View', description: 'Scenic mountain views' },
              { icon: '👥', title: `Ideal for Groups`, description: `Perfect for ${facilityData.capacity || 0} people` },
              { icon: '💰', title: 'Budget-Friendly', description: 'Affordable rates' },
              { icon: '📍', title: 'Ideal Location', description: 'Prime location access' }
            ],
            gallery: facilityData.images?.length > 0 ? facilityData.images : [placeholderImage, placeholderImage, placeholderImage, placeholderImage, placeholderImage]
          };

          setFacility(transformedFacility);
        } else {
          setError('Facility not found');
        }

        // Store unavailable dates from API
        if (unavailableDatesResponse.status === 200 && unavailableDatesResponse.unavailableDates) {
          setUnavailableDates(unavailableDatesResponse.unavailableDates);
        } else {
          setUnavailableDates([]);
        }

        // Set empty reservations array since the API doesn't exist
        setReservations([]);

      } catch (err) {
        console.error('Error fetching facility data:', err);
        setError('Failed to load facility data');
      } finally {
        setLoading(false);
      }
    };

    fetchFacilityData();
  }, [id]);

  // Prefill selected dates when coming back from Reservation Form
  useEffect(() => {
    const pre = location.state?.preselectedDates;
    if (pre) {
      if (pre.dateArrival) {
        const a = new Date(pre.dateArrival);
        const aFormatted = `${a.getDate()} ${a.toLocaleString('default', { month: 'short' })} ${a.getFullYear()}`;
        const aDay = a.toLocaleString('default', { weekday: 'long' });
        setSelectedArrivalDate(pre.dateArrival);
        setSelectedDate(`${aFormatted} - ${aDay}`);
      }

      if (pre.dateDeparture) {
        const d = new Date(pre.dateDeparture);
        const dFormatted = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
        const dDay = d.toLocaleString('default', { weekday: 'long' });
        setSelectedDepartureDate(pre.dateDeparture);
        setSelectedDepartureDateDisplay(`${dFormatted} - ${dDay}`);
      }
      return;
    }

    const storedCheckIn = localStorage.getItem('selectedCheckInDate');
    const storedCheckOut = localStorage.getItem('selectedCheckOutDate');

    if (storedCheckIn) {
      const a = new Date(storedCheckIn);
      if (!isNaN(a.getTime())) {
        const aFormatted = `${a.getDate()} ${a.toLocaleString('default', { month: 'short' })} ${a.getFullYear()}`;
        const aDay = a.toLocaleString('default', { weekday: 'long' });
        setSelectedArrivalDate(storedCheckIn);
        setSelectedDate(`${aFormatted} - ${aDay}`);
      }
    }

    if (storedCheckOut) {
      const d = new Date(storedCheckOut);
      if (!isNaN(d.getTime())) {
        const dFormatted = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
        const dDay = d.toLocaleString('default', { weekday: 'long' });
        setSelectedDepartureDate(storedCheckOut);
        setSelectedDepartureDateDisplay(`${dFormatted} - ${dDay}`);
      }
    }
  }, [location.state]);

  // Validate and correct dates from localStorage against available dates
  useEffect(() => {
    if (!availableDates || availableDates.length === 0 || location.state?.preselectedDates || hasValidatedDatesRef.current) {
      return;
    }

    hasValidatedDatesRef.current = true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const findNextAvailableDate = (startDate) => {
      const availableSet = new Set(availableDates.filter(Boolean));
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 6);
      
      for (let d = new Date(start); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (availableSet.has(dateStr) && d >= today) {
          return dateStr;
        }
      }
      return null;
    };

    const storedCheckIn = localStorage.getItem('selectedCheckInDate');
    const storedCheckOut = localStorage.getItem('selectedCheckOutDate');

    let correctedArrival = null;
    let correctedDeparture = null;

    if (storedCheckIn) {
      const arrivalDateStr = storedCheckIn.includes('T') 
        ? storedCheckIn.split('T')[0] 
        : storedCheckIn;
      
      if (!availableDates.includes(arrivalDateStr)) {
        const nextAvailable = findNextAvailableDate(arrivalDateStr);
        if (nextAvailable) {
          correctedArrival = nextAvailable;
          localStorage.setItem('selectedCheckInDate', nextAvailable);
        }
      } else {
        correctedArrival = arrivalDateStr;
      }
    }

    if (storedCheckOut && (correctedArrival || storedCheckIn)) {
      const departureDateStr = storedCheckOut.includes('T') 
        ? storedCheckOut.split('T')[0] 
        : storedCheckOut;
      const arrivalDateStr = correctedArrival || (storedCheckIn.includes('T') ? storedCheckIn.split('T')[0] : storedCheckIn);
      
      const arrival = new Date(arrivalDateStr);
      const departure = new Date(departureDateStr);
      
      if (!availableDates.includes(departureDateStr) || departure <= arrival) {
        const nextAvailable = findNextAvailableDate(
          new Date(arrival.getTime() + 24 * 60 * 60 * 1000)
        );
        if (nextAvailable) {
          correctedDeparture = nextAvailable;
          localStorage.setItem('selectedCheckOutDate', nextAvailable);
        } else {
          localStorage.removeItem('selectedCheckOutDate');
        }
      } else {
        correctedDeparture = departureDateStr;
      }
    }

    if (correctedArrival && correctedArrival !== storedCheckIn) {
      const a = new Date(correctedArrival);
      const aFormatted = `${a.getDate()} ${a.toLocaleString('default', { month: 'short' })} ${a.getFullYear()}`;
      const aDay = a.toLocaleString('default', { weekday: 'long' });
      setSelectedArrivalDate(correctedArrival);
      setSelectedDate(`${aFormatted} - ${aDay}`);
    }

    if (correctedDeparture !== null) {
      if (correctedDeparture && correctedDeparture !== storedCheckOut) {
        const d = new Date(correctedDeparture);
        const dFormatted = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
        const dDay = d.toLocaleString('default', { weekday: 'long' });
        setSelectedDepartureDate(correctedDeparture);
        setSelectedDepartureDateDisplay(`${dFormatted} - ${dDay}`);
      } else if (!correctedDeparture && storedCheckOut) {
        setSelectedDepartureDate('');
        setSelectedDepartureDateDisplay(null);
      }
    }
  }, [availableDates, location.state?.preselectedDates]);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!id) return;

      setReviewsLoading(true);
      try {
        const response = await getReviewsByFacilityId(id);
        
        if (response.status === 200) {
          setReviews(response.reviews || []);
          setAverageRatings(response.averageRatings || {
            location: 0,
            service: 0,
            cleanliness: 0,
            overall: 0
          });
        }
      } catch (err) {
        console.error('Error fetching reviews:', err);
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchReviews();
  }, [id]);

  // Helper: Check if a date is unavailable based on unavailable dates from API
  // Note: Server handles dormitory capacity logic and returns unavailable dates accordingly
  // Using useMemo to ensure stable reference and avoid circular dependencies
  const isDateUnavailable = useMemo(() => {
    return (dateStr) => {
      if (!dateStr) return false;
      
      // Safely access unavailableDates - use ref to avoid TDZ issues
      const unavailDates = unavailableDatesRef.current ?? [];
      const unavailableSet = new Set(unavailDates.filter(Boolean));
      
      // Check if date is in unavailable dates from API
      return unavailableSet.has(dateStr);
    };
  }, [unavailableDates]);

  // Helper: Check if entire date range is available
  const isDateRangeAvailable = useMemo(() => {
    return (arrivalDateStr, departureDateStr) => {
      if (!arrivalDateStr || !departureDateStr) return false;

      try {
        const arrivalDate = new Date(arrivalDateStr);
        const departureDate = new Date(departureDateStr);

        if (isNaN(arrivalDate.getTime()) || isNaN(departureDate.getTime())) {
          return false;
        }

        for (let d = new Date(arrivalDate); d < departureDate; d.setDate(d.getDate() + 1)) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (d < today) return false;
          if (isDateUnavailable(dateStr)) return false;
        }

        return true;
      } catch {
        return false;
      }
    };
  }, [isDateUnavailable]);

  // Use unavailable dates directly from API for calendar
  // Server already handles dormitory capacity logic and returns unavailable dates
  const reservedDatesForCalendar = useMemo(() => {
    const unavailDates = unavailableDatesRef.current ?? [];
    if (!Array.isArray(unavailDates)) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 6);
    
    // Normalize dates to YYYY-MM-DD format and filter to 6-month window
    const normalizedDates = [];
    
    for (const dateValue of unavailDates) {
      if (!dateValue) continue;
      
      let dateStr = '';
      
      // If already in YYYY-MM-DD format, use it directly
      if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) {
        dateStr = dateValue.trim();
      } else {
        // Otherwise, parse and normalize
        try {
          const dateObj = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);
          if (isNaN(dateObj.getTime())) continue;
          
          dateObj.setHours(0, 0, 0, 0);
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        } catch {
          continue;
        }
      }
      
      // Check if date is within 6-month window
      // Compare dates as strings (YYYY-MM-DD) to avoid timezone issues
      try {
        const todayStr = today.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        // If date is already in YYYY-MM-DD format, compare directly
        if (dateStr >= todayStr && dateStr <= endDateStr) {
          normalizedDates.push(dateStr);
        }
      } catch {
        continue;
      }
    }
    
    // Remove duplicates and return
    return [...new Set(normalizedDates)];
  }, [unavailableDatesVersion, facility?.facilityType]);

  if (loading) {
    return (
      <section className={styles.serviceDetailSection}>
        <div className={styles.container}>
          <h1 className={styles.sectionTitle}>
            FACILITIES / DETAIL VIEW
          </h1>

          <div className={styles.mainContent}>
            <div className={styles.contentContainer}>
              <div className={styles.headerAndDateContainer}>
                <div className={styles.skeletonHeader}>
                  <div className={styles.skeletonHeaderInfo}>
                    <div className={styles.skeletonTitle}></div>
                    <div className={styles.skeletonSubtitle}></div>
                  </div>
                  <div className={styles.skeletonButton}></div>
                </div>

                <div className={styles.skeletonDateChecker}>
                  <div className={styles.skeletonDateInput}>
                    <div className={styles.skeletonDateLabel}></div>
                    <div className={styles.skeletonDateField}></div>
                  </div>
                  <div className={styles.skeletonDateInput}>
                    <div className={styles.skeletonDateLabel}></div>
                    <div className={styles.skeletonDateField}></div>
                  </div>
                </div>
              </div>

              <div className={styles.skeletonImageGallery}>
                <div className={styles.skeletonMainImage}></div>
                <div className={styles.skeletonThumbnailGrid}>
                  <div className={styles.skeletonThumbnail}></div>
                  <div className={styles.skeletonThumbnail}></div>
                  <div className={styles.skeletonThumbnail}></div>
                  <div className={styles.skeletonThumbnail}></div>
                </div>
              </div>

              <div className={styles.skeletonFeaturesGrid}>
                {[1, 2, 3, 4].map((_, index) => (
                  <div key={index} className={styles.skeletonFeatureCard}>
                    <div className={styles.skeletonFeatureIcon}></div>
                    <div className={styles.skeletonFeatureTitle}></div>
                  </div>
                ))}
              </div>

              <div className={styles.skeletonReviewsSection}>
                <div className={styles.skeletonReviewHeader}>
                  <div className={styles.skeletonReviewTitle}></div>
                  <div className={styles.skeletonReviewButton}></div>
                </div>
                <div className={styles.skeletonReviewScores}>
                  <div className={styles.skeletonScoreItem}></div>
                  <div className={styles.skeletonScoreItem}></div>
                  <div className={styles.skeletonScoreItem}></div>
                </div>
                <div className={styles.skeletonReviewContent}>
                  <div className={styles.skeletonReviewText}></div>
                  <div className={styles.skeletonReviewAuthor}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.serviceDetailSection}>
        <div className={styles.error}>{error}</div>
      </section>
    );
  }

  if (!facility) {
    return (
      <section className={styles.serviceDetailSection}>
        <div className={styles.error}>Facility not found</div>
      </section>
    );
  }

  function toYMDFromParts(year, monthZeroBased, dayNum) {
    return `${year}-${String(monthZeroBased + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  }

  const getCalendarData = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth(); 

    const firstDayOfMonth = new Date(year, month, 1);
    const firstDayIndex = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarDays = [];
    for (let i = 0; i < firstDayIndex; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);
    while (calendarDays.length < 42) calendarDays.push(null);

    const allMonthYMD = Array.from({ length: daysInMonth }, (_, i) =>
      toYMDFromParts(year, month, i + 1)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reservedYMD = [];
    const reservedDaysNumbers = [];

    allMonthYMD.forEach((dateStr, idx) => {
      const dayNumber = idx + 1;
      const dateObj = new Date(dateStr);
      
      // Mark as reserved if in the past or unavailable
      if (dateObj < today || isDateUnavailable(dateStr)) {
        reservedYMD.push(dateStr);
        reservedDaysNumbers.push(dayNumber);
      }
    });

    return {
      monthDisplay: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
      daysOfWeek: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
      calendarDaysGrid: calendarDays,
      reservedSet: new Set(reservedYMD),
      reservedDatesArr: reservedYMD,
      reservedDaysNumbers,
      availableDatesArr: Array.from(new Set(availableDates.filter(Boolean))),
    };
  };

  const calendarData = getCalendarData(currentDate);

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDateClick = (day) => {
    if (!day) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const selectedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const dateObj = new Date(selectedDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if date is in the past
    if (dateObj < today) {
      return;
    }

    // Check if date is unavailable
    if (isDateUnavailable(selectedDateStr)) {
      return;
    }

    const formattedDate = `${day} ${dateObj.toLocaleString('default', { month: 'short' })} ${year}`;
    const dayName = dateObj.toLocaleString('default', { weekday: 'long' });

    if (isSelectingDeparture) {
      // Validate departure date is after arrival date
      if (selectedArrivalDate) {
        const arrivalDateObj = new Date(selectedArrivalDate);
        if (dateObj <= arrivalDateObj) {
          setDepartureDateError('Departure date must be after arrival date');
          return;
        }
        
        // Check if entire date range is available
        if (!isDateRangeAvailable(selectedArrivalDate, selectedDateStr)) {
          setDepartureDateError('Selected date range includes unavailable dates. Please select a different range.');
          return;
        }
      }
      setSelectedDepartureDateDisplay(`${formattedDate} - ${dayName}`);
      setSelectedDepartureDate(selectedDateStr);
      setDepartureDateError('');
      setIsSelectingDeparture(false);
    } else {
      // If departure date is already selected, validate it's still valid
      if (selectedDepartureDate) {
        const departureDateObj = new Date(selectedDepartureDate);
        if (dateObj >= departureDateObj) {
          setSelectedDepartureDate('');
          setSelectedDepartureDateDisplay(null);
          setArrivalDateError('Arrival date must be before departure date. Please reselect departure date.');
        } else {
          setArrivalDateError('');
        }
      } else {
        setArrivalDateError('');
      }
      setSelectedDate(`${formattedDate} - ${dayName}`);
      setSelectedArrivalDate(selectedDateStr);
    }
    setShowCalendar(false);
  };

  const onReserveNow = () => {
    // Prevent reservation if facility is unavailable
    if (isFacilityUnavailable) {
      return;
    }

    setArrivalDateError('');
    setDepartureDateError('');

    let hasError = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!selectedArrivalDate) {
      setArrivalDateError('Please select an arrival date');
      hasError = true;
    } else {
      const arrivalDateObj = new Date(selectedArrivalDate);
      if (arrivalDateObj < today) {
        setArrivalDateError('Arrival date cannot be in the past');
        hasError = true;
      }

      if (isDateUnavailable(selectedArrivalDate)) {
        setArrivalDateError('Selected arrival date is not available');
        hasError = true;
      }
    }

    if (!selectedDepartureDate) {
      setDepartureDateError('Please select a departure date');
      hasError = true;
    } else {
      const departureDateObj = new Date(selectedDepartureDate);
      if (departureDateObj < today) {
        setDepartureDateError('Departure date cannot be in the past');
        hasError = true;
      }

      if (isDateUnavailable(selectedDepartureDate)) {
        setDepartureDateError('Selected departure date is not available');
        hasError = true;
      }

      if (selectedArrivalDate) {
        const arrivalDateObj = new Date(selectedArrivalDate);
        if (departureDateObj <= arrivalDateObj) {
          setDepartureDateError('Departure date must be after arrival date');
          hasError = true;
        }
      }
    }

    if (selectedArrivalDate && selectedDepartureDate && !hasError) {
      const arrivalDateObj = new Date(selectedArrivalDate);
      const departureDateObj = new Date(selectedDepartureDate);
      const diffTime = departureDateObj - arrivalDateObj;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 1) {
        setDepartureDateError('Stay must be at least 1 day');
        hasError = true;
      } else {
        // Check if entire date range is available
        if (!isDateRangeAvailable(selectedArrivalDate, selectedDepartureDate)) {
          setDepartureDateError('Selected date range includes unavailable dates. Please select a different range.');
          hasError = true;
        }
      }
    }

    if (hasError) {
      return;
    }

    const target = `/reservation-form/${type}/${facilityNameParam}/${facility.id}`;

    if (isLoggedIn) {
      const state = {
        facility,
        ...(selectedArrivalDate && {
          preselectedDates: {
            dateArrival: selectedArrivalDate,
            ...(selectedDepartureDate && { dateDeparture: selectedDepartureDate })
          }
        }),
        from: `/user/services/${type}/${facilityNameParam}/${facility.id}`
      };
      navigate(target, { state });
    } else {
      navigate(`/auth/login?redirect=${encodeURIComponent(target)}`);
    }
  };

  const handlePrevReview = () => {
    if (reviews.length === 0) return;
    setCurrentReviewIndex((prev) => 
      prev === 0 ? reviews.length - 1 : prev - 1
    );
  };

  const handleNextReview = () => {
    if (reviews.length === 0) return;
    setCurrentReviewIndex((prev) => 
      prev === reviews.length - 1 ? 0 : prev + 1
    );
  };

  const handleDotClick = (index) => {
    setCurrentReviewIndex(index);
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, index) => (
      <span 
        key={index} 
        className={`${styles.star} ${index < rating ? styles.filled : styles.empty}`}
      >
        ★
      </span>
    ));
  };

  const currentReview = reviews[currentReviewIndex];

  const facilityType = facility?.facilityType || (type && type !== 'undefined' ? type : 'Unknown');
  
  const displayPrice = (facilityType === 'Conference' || facilityType === 'Cottage')
    ? (facility.price || 0)
    : (facility.ratePerPerson || 0);

  const priceLabel = (facilityType === 'Conference' || facilityType === 'Cottage')
    ? 'Price' 
    : 'Rates per Person';

  // Check if facility is unavailable - also check if selected date range is available
  const isFacilityUnavailable = 
    facility?.status !== 'Available' || 
    (availableDates && availableDates.length === 0) ||
    (selectedArrivalDate && selectedDepartureDate && !isDateRangeAvailable(selectedArrivalDate, selectedDepartureDate));

  return (
    <section className={styles.serviceDetailSection}>
      <div className={styles.container}>
        <h1 className={styles.sectionTitle}>
          {facilityType?.toUpperCase() || 'FACILITIES'} / DETAIL VIEW
        </h1>

        <div className={styles.mainContent}>
          <div className={styles.contentContainer}>
            <div className={styles.headerAndDateContainer}>
              <div className={styles.facilityHeader}>
                <div className={styles.facilityInfo}>
                  <h2 className={styles.facilityName}>{facility.name}</h2>
                  <p className={styles.facilityRate}>
                    {priceLabel}: ₱ {displayPrice > 0 ? displayPrice.toLocaleString() : 'N/A'}
                  </p>
                  {facilityType === 'Dormitory' && (
                    <p className={styles.packageNote}>
                      <strong>Important:</strong> Individual type bookings do not include food in the package for Dormitory facilities.
                    </p>
                  )}
                  <p className={styles.confirmationNote}>
                    <strong>Note:</strong> Reservations are required at least two months prior to the intended arrival date and must be confirmed one month in advance. 
                    Check-in time is at 2:00 PM. Guests requesting an earlier check-in should note that the previous day will be included in the billing and must be selected at the time of reservation. 
                    For individual bookings, a confirmation fee of 10% of the total cost is required. The prices displayed already include a 10% service fee and are subject to change.
                  </p>
                </div>
              </div>

              <div className={styles.dateChecker}>
                <div className={styles.dateInputs}>
                  <div className={styles.dateInput}>
                    <label>Arrival Date<span style={{color: 'red'}}>*</span></label>
                    <div
                      className={styles.dateField}
                      onClick={() => {
                        setIsSelectingDeparture(false);
                        setShowCalendar(true);
                        setArrivalDateError(''); 
                      }}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span>{selectedDate || 'Select arrival date'}</span>
                      <span>📅</span>
                    </div>
                    {arrivalDateError && (
                      <div style={{ color: '#e74c3c', fontSize: '0.85rem', marginTop: '5px', fontWeight: '500' }}>
                        {arrivalDateError}
                      </div>
                    )}
                  </div>
                  <div className={styles.dateInput}>
                    <label>Departure Date<span style={{color: 'red'}}>*</span></label>
                    <div
                      className={styles.dateField}
                      onClick={() => {
                        setIsSelectingDeparture(true);
                        setShowCalendar(true);
                        setDepartureDateError('');
                      }}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span>{selectedDepartureDateDisplay || 'Select departure date'}</span>
                      <span>📅</span>
                    </div>
                    {departureDateError && (
                      <div style={{ color: '#e74c3c', fontSize: '0.85rem', marginTop: '5px', fontWeight: '500' }}>
                        {departureDateError}
                      </div>
                    )}
                  </div>
                </div>
                {isFacilityUnavailable && (
                  <div style={{ 
                    marginTop: '15px', 
                    padding: '12px', 
                    backgroundColor: '#fff3cd', 
                    border: '1px solid #ffc107', 
                    borderRadius: '4px',
                    color: '#856404'
                  }}>
                    <strong>⚠️ Selected dates unavailable:</strong> The date range you selected is not available. Please choose different dates.
                  </div>
                )}
                <button 
                  className={styles.reserveButton} 
                  onClick={onReserveNow}
                  disabled={isFacilityUnavailable}
                  style={isFacilityUnavailable ? { 
                    opacity: 0.6, 
                    cursor: 'not-allowed' 
                  } : {}}
                >
                  Reserve Now
                </button>
              </div>
            </div>

            {showCalendar && (
              <div className={styles.calendarOverlay}>
                <div className={styles.calendarModal}>
                  <div className={styles.calendarHeader}>
                    <h3>{isSelectingDeparture ? 'Select Departure Date' : 'Availability Calendar'}</h3>
                    <button
                      className={styles.closeButton}
                      onClick={() => {
                        setShowCalendar(false);
                        setIsSelectingDeparture(false);
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <Calendar
                    selectedDate={selectedArrivalDate || new Date()}
                    onDateSelect={({ date, ymd, formatted }) => {
                      // Check if date is unavailable
                      if (isDateUnavailable(ymd)) {
                        if (isSelectingDeparture) {
                          setDepartureDateError('This date is not available. Please select another date.');
                        } else {
                          setArrivalDateError('This date is not available. Please select another date.');
                        }
                        return;
                      }

                      if (isSelectingDeparture) {
                        if (selectedArrivalDate && new Date(ymd) <= new Date(selectedArrivalDate)) {
                          setDepartureDateError('Departure date must be after arrival date');
                          return;
                        }
                        
                        // Check if entire date range is available
                        if (selectedArrivalDate && !isDateRangeAvailable(selectedArrivalDate, ymd)) {
                          setDepartureDateError('Selected date range includes unavailable dates. Please select a different range.');
                          return;
                        }
                        
                        setSelectedDepartureDate(ymd);
                        setSelectedDepartureDateDisplay(`${formatted} - ${date.toLocaleString('default', { weekday: 'long' })}`);
                        setDepartureDateError('');
                        setIsSelectingDeparture(false);
                      } else {
                        if (selectedDepartureDate && new Date(ymd) >= new Date(selectedDepartureDate)) {
                          setSelectedDepartureDate('');
                          setSelectedDepartureDateDisplay(null);
                          setArrivalDateError('Arrival date must be before departure date. Please reselect departure date.');
                        } else {
                          setArrivalDateError('');
                        }
                        setSelectedArrivalDate(ymd);
                        setSelectedDate(`${formatted} - ${date.toLocaleString('default', { weekday: 'long' })}`);
                      }
                      setShowCalendar(false);
                    }}
                    onClose={() => {
                      setShowCalendar(false);
                      setIsSelectingDeparture(false);
                    }}
                    minDate={isSelectingDeparture ? selectedArrivalDate : null}
                    reservedDates={reservedDatesForCalendar}
                  />
                </div>
              </div>
            )}

            <div className={styles.imageGallery}>
              <div className={styles.mainImage}>
                <img src={facility.gallery[0]} alt={facility.name} />
              </div>
              <div className={styles.thumbnailGrid}>
                {facility.gallery.slice(1, 5).map((image, index) => (
                  <div key={index} className={styles.thumbnail}>
                    <img src={image} alt={`${facility.name} ${index + 2}`} />
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.featuresGrid}>
              {facility.features.map((feature, index) => (
                <div key={index} className={styles.featureCard}>
                  <div className={styles.featureIcon}>{feature.icon}</div>
                  <h4 className={styles.featureTitle}>{feature.title}</h4>
                </div>
              ))}
            </div>

            <div className={styles.reviewsSection}>
              <div className={styles.reviewsHeader}>
                <h3>Reviews</h3>
                <button 
                  onClick={() => setIsReviewsOpen(!isReviewsOpen)}
                  className={styles.readAllReviews}
                >
                  View All Reviews
                </button>
              </div>
              
              {isReviewsOpen ? (
                <Reviews facilityName={facility.name} facilityId={id} />
              ) : (
                <>
                  <div className={styles.reviewFilters}>
                    <button className={styles.filterButton}>
                      Location {Math.round(averageRatings.location * 10) / 10 || 0}
                    </button>
                    <button className={styles.filterButton}>
                      Service {Math.round(averageRatings.service * 10) / 10 || 0}
                    </button>
                    <button className={styles.filterButton}>
                      Cleanliness {Math.round(averageRatings.cleanliness * 10) / 10 || 0}
                    </button>
                  </div>
                  
                  {reviewsLoading ? (
                    <div className={styles.reviewContent}>
                      <p>Loading reviews...</p>
                    </div>
                  ) : reviews.length > 0 ? (
                    <div className={styles.reviewsList}>
                      {reviews.map((review, index) => {
                        const overallRating = review.rating?.overall || 0;
                        const starRating = overallRating > 0 ? Math.round(overallRating / 2) : 0;
                        return (
                          <div key={review.id || index} className={styles.reviewCard}>
                            <div className={styles.reviewCardHeader}>
                              <div className={styles.reviewAvatar}></div>
                              <div className={styles.reviewCardInfo}>
                                <h4 className={styles.reviewCardName}>
                                  {review.authorName || 'Anonymous'}
                                </h4>
                                <div className={styles.reviewCardStars}>
                                  {renderStars(starRating)}
                                </div>
                              </div>
                            </div>
                            <p className={styles.reviewCardText}>{review.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.reviewContent}>
                      <p>No reviews yet.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default MainServicesServiceDetail;