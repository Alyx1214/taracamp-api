import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import styles from './ServiceDetail.module.css';
import placeholderImage from '../../assets/conference.jpg';
import Calendar from './Calendar';
import { getFacilityById, getAvailableDatesByFacility } from '../../apis/facilityApi';
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
  const { type, name, facilityName, id } = useParams();
  const facilityNameParam = name || facilityName;
  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
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
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const API = import.meta.env.VITE_API_URL; 

  useEffect(() => {
    const fetchFacilityData = async () => {
      if (!id) return;

      setLoading(true);
      setError(null);

      try {
        const [facilityResponse, availableDatesResponse] = await Promise.all([
          getFacilityById(id),
          getAvailableDatesByFacility(id)
        ]);

        if (facilityResponse.status === 200 && facilityResponse.facility) {
          const facilityData = facilityResponse.facility;
          
          const transformedFacility = {
            id: facilityData._id || facilityData.id,
            name: facilityData.name,
            facilityType: facilityData.facilityType,
            capacity: facilityData.capacity,
            ratePerPerson: facilityData.ratePerPerson,
            price: facilityData.price,
            image: facilityData.images?.[0] || placeholderImage,
            features: [
              { icon: '🏔️', title: 'Great View', description: 'Scenic mountain views' },
              { icon: '👥', title: `Ideal for Groups`, description: `Perfect for ${facilityData.capacity} people` },
              { icon: '💰', title: 'Budget-Friendly', description: 'Affordable rates' },
              { icon: '📍', title: 'Ideal Location', description: 'Prime location access' }
            ],
            gallery: facilityData.images?.length > 0 ? facilityData.images : [placeholderImage, placeholderImage, placeholderImage, placeholderImage, placeholderImage]
          };

          setFacility(transformedFacility);
        } else {
          setError('Facility not found');
        }

        if (availableDatesResponse.status === 200 && availableDatesResponse.availableDates) {
          setAvailableDates(availableDatesResponse.availableDates);
        }

      } catch (err) {
        console.error('Error fetching facility data:', err);
        setError('Failed to load facility data');
      } finally {
        setLoading(false);
      }
    };

    fetchFacilityData();
  }, [id]);

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

  if (loading) {
    return (
      <section className={styles.serviceDetailSection}>
        <div className={styles.loading}>Loading...</div>
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

    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const allMonthDates = Array.from({ length: daysInMonth }, (_, i) =>
      monthStr + String(i + 1).padStart(2, '0')
    );

    const availableSet = new Set(availableDates);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const availableCalendarDates = [];
    const reservedDates = [];

    allMonthDates.forEach((dateStr, idx) => {
      const dateObj = new Date(dateStr);
      const dayNumber = idx + 1;
      
      if (availableSet.has(dateStr) && dateObj >= today) {
        availableCalendarDates.push(dayNumber);
      } else {
        reservedDates.push(dayNumber);
      }
    });

    return {
      monthDisplay: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
      daysOfWeek: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
      calendarDaysGrid: calendarDays,
      availableDates: availableCalendarDates,
      reservedDates,
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

    if (!availableDates.includes(selectedDateStr)) {
      console.log('Date not available:', selectedDateStr);
      return;
    }

    if (dateObj < today) {
      console.log('Date is in the past:', selectedDateStr);
      return;
    }

    const formattedDate = `${day} ${dateObj.toLocaleString('default', { month: 'short' })} ${year}`;
    const dayName = dateObj.toLocaleString('default', { weekday: 'long' });

    if (isSelectingDeparture) {
      setSelectedDepartureDateDisplay(`${formattedDate} - ${dayName}`);
      setSelectedDepartureDate(selectedDateStr);
      setIsSelectingDeparture(false);
    } else {
      setSelectedDate(`${formattedDate} - ${dayName}`);
      setSelectedArrivalDate(selectedDateStr);
    }
    setShowCalendar(false);
  };

  const onReserveNow = () => {
    // Validate that both dates are selected
    if (!selectedArrivalDate || !selectedDepartureDate) {
      setShowErrorPopup(true);
      return;
    }

    const target = `/reservation-form/${type}/${facilityNameParam}/${facility.id}`;

    if (isLoggedIn) {
      const state = { facility };
      if (selectedArrivalDate) {
        state.preselectedDates = {
          dateArrival: selectedArrivalDate,
          ...(selectedDepartureDate && { dateDeparture: selectedDepartureDate })
        };
      }
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

  const currentReview = reviews[currentReviewIndex];

  const displayPrice = facility.facilityType === 'CONFERENCE' 
    ? facility.price 
    : facility.ratePerPerson;

  const priceLabel = facility.facilityType === 'CONFERENCE' 
    ? 'Price' 
    : 'Rates per Person';

  return (
    <section className={styles.serviceDetailSection}>
      <div className={styles.container}>
        <h1 className={styles.sectionTitle}>
          {type?.toUpperCase() || facility.facilityType?.toUpperCase() || 'FACILITIES'} / DETAIL VIEW
        </h1>

        <div className={styles.mainContent}>
          <div className={styles.contentContainer}>
            <div className={styles.headerAndDateContainer}>
              <div className={styles.facilityHeader}>
                <div className={styles.facilityInfo}>
                  <h2 className={styles.facilityName}>{facility.name}</h2>
                  <p className={styles.facilityRate}>
                    {priceLabel}: ₱ {displayPrice?.toLocaleString() || 'N/A'}
                  </p>
                </div>
                <button className={styles.reserveButton} onClick={onReserveNow}>
                  Reserve Now
                </button>
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
                      }}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span>{selectedDate || 'Select arrival date'}</span>
                      <span>📅</span>
                    </div>
                  </div>
                  <div className={styles.dateInput}>
                    <label>Departure Date<span style={{color: 'red'}}>*</span></label>
                    <div
                      className={styles.dateField}
                      onClick={() => {
                        setIsSelectingDeparture(true);
                        setShowCalendar(true);
                      }}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span>{selectedDepartureDateDisplay || 'Select departure date'}</span>
                      <span>📅</span>
                    </div>
                  </div>
                </div>
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
                    currentDate={currentDate}
                    onPrevMonth={handlePrevMonth}
                    onNextMonth={handleNextMonth}
                    calendarData={calendarData}
                    onDateClick={handleDateClick}
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
                <button className={styles.readAllReviews}>Read all reviews</button>
              </div>
              <div className={styles.reviewScores}>
                <div className={styles.scoreItem}>
                  <span className={styles.scoreLabel}>Location</span>
                  <span className={styles.scoreValue}>{averageRatings.location}</span>
                </div>
                <div className={styles.scoreItem}>
                  <span className={styles.scoreLabel}>Service</span>
                  <span className={styles.scoreValue}>{averageRatings.service}</span>
                </div>
                <div className={styles.scoreItem}>
                  <span className={styles.scoreLabel}>Cleanliness</span>
                  <span className={styles.scoreValue}>{averageRatings.cleanliness}</span>
                </div>
              </div>
              
              {reviewsLoading ? (
                <div className={styles.reviewContent}>
                  <p>Loading reviews...</p>
                </div>
              ) : reviews.length > 0 && currentReview ? (
                <>
                  <div className={styles.reviewContent}>
                    <p className={styles.reviewText}>
                      {currentReview.text}
                    </p>
                    <div className={styles.reviewMeta}>
                      <span className={styles.reviewAuthor}>
                        {currentReview.authorName || 'Anonymous'}
                        {currentReview.isVerified && ' ✓'}
                      </span>
                    </div>
                  </div>
                  
                  <div className={styles.reviewNavigation}>
                    <button 
                      className={styles.navButton}
                      onClick={handlePrevReview}
                      aria-label="Previous review"
                    >
                      ❮
                    </button>
                    <div className={styles.reviewDots}>
                      {reviews.map((_, index) => (
                        <span 
                          key={index}
                          className={`${styles.dot} ${index === currentReviewIndex ? styles.active : ''}`}
                          onClick={() => handleDotClick(index)}
                          role="button"
                          tabIndex={0}
                          aria-label={`Go to review ${index + 1}`}
                        ></span>
                      ))}
                    </div>
                    <button 
                      className={styles.navButton}
                      onClick={handleNextReview}
                      aria-label="Next review"
                    >
                      ❯
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.reviewContent}>
                  <p>No reviews available yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showErrorPopup && (
        <div className={styles.errorPopupOverlay}>
          <div className={styles.errorPopupModal}>
            <div className={styles.errorIcon}>⚠️</div>
            <h3 className={styles.errorTitle}>Required Fields Missing</h3>
            <p className={styles.errorMessage}>
              Please select both arrival and departure dates before making a reservation.
            </p>
            <button
              className={styles.errorButton}
              onClick={() => setShowErrorPopup(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default MainServicesServiceDetail;