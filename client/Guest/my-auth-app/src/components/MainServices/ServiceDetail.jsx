import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import styles from './ServiceDetail.module.css';
import placeholderImage from '../../assets/conference.jpg';
import { getFacilityById, getAvailableDatesByFacility, } from '../../apis/facilityApi'; 

const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try { return !!localStorage.getItem('accessToken'); } catch { return false; }
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
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const API = import.meta.env.VITE_API_URL; 

  useEffect(() => {
    let active = true;
    setLoading(true);

    getFacilityById(id)
      .then((data) => {
        if (!active) return;
        if (data?.status === 200 && data?.facility) {
          setFacility(data.facility);
        } else {
          setFacility(null);
        }
      })
      .catch(() => {
        if (!active) return;
        setFacility(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;

    getAvailableDatesByFacility(id)
      .then((data) => {
        if (!active) return;
        if (data?.status === 200) {
          setAvailableDates(data.availableDates || []);
        } else {
          setAvailableDates([]);
        }
      })
      .catch(() => {
        if (!active) return;
        setAvailableDates([]);
      });

    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <section className={styles.serviceDetailSection}>
        <div>Loading...</div>
      </section>
    );
  }

  const BackLink = ({ children }) => (
    <Link to=".." relative="path" className={styles.backButton}>
      {children}
    </Link>
  );

  if (!facility) {
    return (
      <section className={styles.serviceDetailSection}>
        <h2 className={styles.sectionTitle}>Service Not Found</h2>
        <p>The requested service could not be found. Please go back to the list.</p>
        <BackLink>Back to {type?.[0]?.toUpperCase() + type?.slice(1)}</BackLink>
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
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const reservedDates = allMonthDates
      .map((dateStr, idx) => {
        const dateObj = new Date(dateStr);
        if (!availableSet.has(dateStr) || dateObj < today) return idx + 1;
        return null;
      })
      .filter(Boolean);

    return {
      monthDisplay: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
      daysOfWeek: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
      calendarDaysGrid: calendarDays,
      reservedDates
    };
  };

  const calendarData = getCalendarData(currentDate);

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const getPriceLabel = () =>
    facility.facilityType === 'CONFERENCE' ? 'Price' : 'Rates per Person';

  const onReserveNow = () => {
  const facilityId =
    typeof facility === 'string' ? facility : facility?._id || facility?.id || id;

  const target = `/reservation-form/${type}/${facilityId}`;

  if (isLoggedIn) {
    navigate(target);
    } else {
      navigate(`/auth/login?redirect=${encodeURIComponent(target)}`);
    }
  };

  return (
    <section className={styles.serviceDetailSection}>
      <h2 className={styles.sectionTitle}>{type.toUpperCase()} / DETAIL VIEW</h2>

      <div className={styles.detailContentContainer}>
        <div className={styles.detailCard}>
          <div
            className={styles.detailImage}
            style={{ backgroundImage: `url(${facility.image || placeholderImage})` }}
          />
          <h3 className={styles.detailName}>{facility.name}</h3>
          <p className={styles.detailCapacity}>
            Capacity: {facility.capacity}{facility.facilityType === 'DORMITORY' ? ' pax' : ''}
          </p>
          <p className={styles.detailRate}>
            {getPriceLabel()} : ₱ {facility.ratePerPerson || facility.price}
          </p>
          <button className={styles.reserveButton} onClick={onReserveNow}>Reserve Now!</button>
          <BackLink>Back to {type?.[0]?.toUpperCase() + type?.slice(1)}</BackLink>
        </div>

        <div className={styles.reservationsCalendar}>
          <h4 className={styles.calendarHeader}>Reservations Calendar</h4>
          <div className={styles.calendarMonthNav}>
            <span className={styles.navArrow} onClick={handlePrevMonth}>&lt;</span>
            <span className={styles.currentMonth}>{calendarData.monthDisplay}</span>
            <span className={styles.navArrow} onClick={handleNextMonth}>&gt;</span>
          </div>
          <div className={styles.calendarGrid}>
            {calendarData.daysOfWeek.map(day => (
              <div key={day} className={styles.calendarDayHeader}>{day}</div>
            ))}
            {calendarData.calendarDaysGrid.map((date, index) => {
              const isToday =
                date &&
                date === new Date().getDate() &&
                currentDate.getMonth() === new Date().getMonth() &&
                currentDate.getFullYear() === new Date().getFullYear();

              const isReserved = date && calendarData.reservedDates.includes(date);

              return (
                <div
                  key={index}
                  className={`${styles.calendarDate} ${isReserved ? styles.reservedDate : ''} ${isToday ? styles.currentDay : ''}`}
                >
                  {date || ''}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default MainServicesServiceDetail;
