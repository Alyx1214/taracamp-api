import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import styles from './ServiceDetail.module.css';
import placeholderImage from '../../assets/conference.jpg';
import Calendar from './Calendar';

// Dummy data for testing
const dummyFacility = {
  id: '1',
  name: 'Cottage (4-5 pax)',
  facilityType: 'COTTAGE',
  capacity: '4-5 pax',
  ratePerPerson: 2600,
  image: placeholderImage,
  features: [
    { icon: '🏔️', title: 'Great View', description: 'Scenic mountain views' },
    { icon: '👥', title: 'Ideal for Groups', description: 'Perfect for 4-5 people' },
    { icon: '💰', title: 'Budget-Friendly', description: 'Affordable rates' },
    { icon: '📍', title: 'Ideal Location', description: 'Prime location access' }
  ],
  reviews: {
    location: 9.4,
    service: 8.4,
    cleanliness: 8.4,
    overall: 8.7
  },
  gallery: [
    placeholderImage,
    placeholderImage,
    placeholderImage,
    placeholderImage,
    placeholderImage
  ]
};

const dummyAvailableDates = ['2025-11-08', '2025-11-11', '2025-11-15', '2025-11-20', '2025-11-25'];

const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try {
      return !!localStorage.getItem('accessToken');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onStorage = () => setIsLoggedIn(!!localStorage.getItem('accessToken'));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { isLoggedIn };
};

function MainServicesServiceDetail() {
  const { type, id } = useParams();
  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableDates, setAvailableDates] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    // Simulate API call with dummy data
    setLoading(true);
    setTimeout(() => {
      setFacility(dummyFacility);
      setAvailableDates(dummyAvailableDates);
      setLoading(false);
    }, 1000);
  }, [id]);

  if (loading) {
    return (
      <section className={styles.serviceDetailSection}>
        <div className={styles.loading}>Loading...</div>
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

    const reservedDates = allMonthDates
      .map((dateStr, idx) => {
        const dateObj = new Date(dateStr);
        if (!availableSet.has(dateStr) || dateObj < today) return idx + 1;
        return null;
      })
      .filter(Boolean);

    return {
      monthDisplay: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
      daysOfWeek: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
      calendarDaysGrid: calendarDays,
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
    
    if (availableDates.includes(selectedDateStr)) {
      const dateObj = new Date(selectedDateStr);
      const formattedDate = `${day} ${dateObj.toLocaleString('default', { month: 'short' })} ${year}`;
      const dayName = dateObj.toLocaleString('default', { weekday: 'long' });
      
      setSelectedDate(`${formattedDate} - ${dayName}`);
      setShowCalendar(false);
    }
  };

  const onReserveNow = () => {
    const target = `/reservation-form/${type}/${facility.id}`;

    if (isLoggedIn) {
      navigate(target);
    } else {
      navigate(`/auth/login?redirect=${encodeURIComponent(target)}`);
    }
  };

  const formatAvailableDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    const dayName = date.toLocaleString('default', { weekday: 'long' });
    
    return { day, month, year, dayName };
  };

  const handleDateCardClick = (dateStr) => {
    const { day, month, year, dayName } = formatAvailableDate(dateStr);
    setSelectedDate(`${day} ${month} ${year} - ${dayName}`);
    
    // Set the calendar to show the month of the clicked date
    const clickedDate = new Date(dateStr);
    setCurrentDate(new Date(clickedDate.getFullYear(), clickedDate.getMonth(), 1));
    setShowCalendar(true);
  };

  return (
    <section className={styles.serviceDetailSection}>
      <div className={styles.container}>
        <h1 className={styles.sectionTitle}>
          {type?.toUpperCase() || 'COTTAGES'} / DETAIL VIEW
        </h1>

        <div className={styles.mainContent}>
          <div className={styles.contentContainer}>
            {/* Facility Header and Date Checker Container */}
            <div className={styles.headerAndDateContainer}>
              <div className={styles.facilityHeader}>
                <div className={styles.facilityInfo}>
                  <h2 className={styles.facilityName}>{facility.name}</h2>
                  <p className={styles.facilityRate}>
                    Rates per Person: ₱ {facility.ratePerPerson.toLocaleString()}
                  </p>
                </div>
                <button className={styles.reserveButton} onClick={onReserveNow}>
                  Reserve Now
                </button>
              </div>

              {/* Date Availability Checker */}
              <div className={styles.dateChecker}>
                <div className={styles.dateInputs}>
                  <div className={styles.dateInput}>
                    <label>Arrival Date</label>
                    <input 
                      type="date" 
                      className={styles.dateField}
                      placeholder="Select arrival date"
                      value={selectedDate || ''}
                      onClick={() => setShowCalendar(true)}
                    />
                  </div>
                  <div className={styles.dateInput}>
                    <label>Departure Date</label>
                    <input 
                      type="date" 
                      className={styles.dateField}
                      placeholder="Select departure date"
                      onClick={() => setShowCalendar(true)}
                    />
                  </div>
                </div>  
              </div>
            </div>

            {/* Calendar Popup */}
            {showCalendar && (
              <div className={styles.calendarOverlay}>
                <div className={styles.calendarModal}>
                  <div className={styles.calendarHeader}>
                    <h3>Availability Calendar</h3>
                    <button 
                      className={styles.closeButton}
                      onClick={() => setShowCalendar(false)}
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

            {/* Image Gallery */}
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

            {/* Features Grid */}
            <div className={styles.featuresGrid}>
              {facility.features.map((feature, index) => (
                <div key={index} className={styles.featureCard}>
                  <div className={styles.featureIcon}>{feature.icon}</div>
                  <h4 className={styles.featureTitle}>{feature.title}</h4>
                </div>
              ))}
            </div>

            {/* Reviews Section */}
            <div className={styles.reviewsSection}>
              <div className={styles.reviewsHeader}>
                <h3>Reviews</h3>
                <button className={styles.readAllReviews}>Read all reviews</button>
              </div>
              <div className={styles.reviewScores}>
                <div className={styles.scoreItem}>
                  <span className={styles.scoreLabel}>Location</span>
                  <span className={styles.scoreValue}>{facility.reviews.location}</span>
                </div>
                <div className={styles.scoreItem}>
                  <span className={styles.scoreLabel}>Service</span>
                  <span className={styles.scoreValue}>{facility.reviews.service}</span>
                </div>
                <div className={styles.scoreItem}>
                  <span className={styles.scoreLabel}>Cleanliness</span>
                  <span className={styles.scoreValue}>{facility.reviews.cleanliness}</span>
                </div>
              </div>
              
              {/* Review Content */}
              <div className={styles.reviewContent}>
                <p className={styles.reviewText}>
                  Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has be...
                </p>
              </div>
              
              <div className={styles.reviewNavigation}>
                <button className={styles.navButton}>❮</button>
                <div className={styles.reviewDots}>
                  <span className={`${styles.dot} ${styles.active}`}></span>
                  <span className={styles.dot}></span>
                  <span className={styles.dot}></span>
                </div>
                <button className={styles.navButton}>❯</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default MainServicesServiceDetail;