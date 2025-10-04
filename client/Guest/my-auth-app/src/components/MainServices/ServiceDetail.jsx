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
  const [arrivalDateError, setArrivalDateError] = useState('');
  const [departureDateError, setDepartureDateError] = useState('');
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

  const availableSet = new Set((availableDates || []).filter(Boolean));

  const today = new Date();
  today.setHours(0,0,0,0);

  const reservedYMD = [];
  const reservedDaysNumbers = []; // optional: day numbers (1..31) for legacy usage if you need it

  allMonthYMD.forEach((dateStr, idx) => {
    const dayNumber = idx + 1;
    const dateObj = new Date(dateStr);
    // consider reserved if not in availableSet OR it's in the past
    const isAvailable = availableSet.has(dateStr);
    if (!isAvailable || dateObj < today) {
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
    availableDatesArr: Array.from(availableSet),
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
      // Validate departure date is after arrival date
      if (selectedArrivalDate) {
        const arrivalDateObj = new Date(selectedArrivalDate);
        if (dateObj <= arrivalDateObj) {
          setDepartureDateError('Departure date must be after arrival date');
          return;
        }
      }
      setSelectedDepartureDateDisplay(`${formattedDate} - ${dayName}`);
      setSelectedDepartureDate(selectedDateStr);
      setDepartureDateError(''); // Clear any previous error
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
          setArrivalDateError(''); // Clear any previous error
        }
      } else {
        setArrivalDateError(''); // Clear any previous error
      }
      setSelectedDate(`${formattedDate} - ${dayName}`);
      setSelectedArrivalDate(selectedDateStr);
    }
    setShowCalendar(false);
  };

  const onReserveNow = () => {
    // Clear previous errors
    setArrivalDateError('');
    setDepartureDateError('');

    // Validate that both dates are selected
    let hasError = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!selectedArrivalDate) {
      setArrivalDateError('Please select an arrival date');
      hasError = true;
    } else {
      // Validate arrival date is not in the past
      const arrivalDateObj = new Date(selectedArrivalDate);
      if (arrivalDateObj < today) {
        setArrivalDateError('Arrival date cannot be in the past');
        hasError = true;
      }

      // Validate arrival date is available
      if (!availableDates.includes(selectedArrivalDate)) {
        setArrivalDateError('Selected arrival date is not available');
        hasError = true;
      }
    }

    if (!selectedDepartureDate) {
      setDepartureDateError('Please select a departure date');
      hasError = true;
    } else {
      // Validate departure date is not in the past
      const departureDateObj = new Date(selectedDepartureDate);
      if (departureDateObj < today) {
        setDepartureDateError('Departure date cannot be in the past');
        hasError = true;
      }

      // Validate departure date is available
      if (!availableDates.includes(selectedDepartureDate)) {
        setDepartureDateError('Selected departure date is not available');
        hasError = true;
      }

      // Validate departure date is after arrival date
      if (selectedArrivalDate) {
        const arrivalDateObj = new Date(selectedArrivalDate);
        if (departureDateObj <= arrivalDateObj) {
          setDepartureDateError('Departure date must be after arrival date');
          hasError = true;
        }
      }
    }

    // Additional validation: Check if stay duration is reasonable (at least 1 day)
    if (selectedArrivalDate && selectedDepartureDate && !hasError) {
      const arrivalDateObj = new Date(selectedArrivalDate);
      const departureDateObj = new Date(selectedDepartureDate);
      const diffTime = departureDateObj - arrivalDateObj;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 1) {
        setDepartureDateError('Stay must be at least 1 day');
        hasError = true;
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
        from: `/service-detail/${type}/${facilityNameParam}/${facility.id}`
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

  const currentReview = reviews[currentReviewIndex];

  const displayPrice = facility.facilityType === 'Conference' 
    ? facility.price 
    : facility.ratePerPerson;

  const priceLabel = facility.facilityType === 'Conference' 
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
                        setArrivalDateError(''); // Clear error when clicking
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
                        setDepartureDateError(''); // Clear error when clicking
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

    </section>
  );
}

export default MainServicesServiceDetail;