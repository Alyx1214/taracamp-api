import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import styles from './ServiceDetail.module.css';
import placeholderImage from '../../assets/conference.jpg';

const typeToFacilityType = {
  dormitories: 'DORMITORY',
  cottages: 'COTTAGE',
  conference: 'CONFERENCE'
};

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

// const allServiceData = {
//   dormitories: [
//     { id: 1, name: 'QUIRINO HALL', capacity: '20 pax', rate: '375' },
//     { id: 2, name: 'ROXAS HALL', capacity: '20 pax', rate: '375' },
//     { id: 3, name: 'RECTO HALL', capacity: '20 pax', rate: '375' },
//     { id: 4, name: 'ESCODA ROOM 104', capacity: '20 pax', rate: '375' },
//     { id: 5, name: 'PAGES HALL', capacity: '20 pax', rate: '375' },
//     { id: 6, name: 'SQ MEDICAL', capacity: '20 pax', rate: '375' },
//     { id: 7, name: 'HERNANDEZ HALL 1-7A', capacity: '20 pax', rate: '375' },
//     { id: 8, name: 'SQ MAIN 101-102', capacity: '20 pax', rate: '375' },
//     { id: 9, name: 'ESCODA HALL', capacity: '20 pax', rate: '375' },
//     { id: 10, name: 'BACHELORS HALL', capacity: '20 pax', rate: '375' },
//     { id: 11, name: 'STAFFHOUSE', capacity: '20 pax', rate: '375' },
//     { id: 12, name: 'MAGSAYSAY', capacity: '20 pax', rate: '375' },
//     { id: 13, name: 'SQ ANNEX', capacity: '20 pax', rate: '375' },
//     { id: 14, name: 'SQ MAIN', capacity: '20 pax', rate: '375' },
//     { id: 15, name: 'HERNANDEZ', capacity: '20 pax', rate: '375' },
//   ],
//   cottages: [
//     { id: 1, name: 'COTTAGE (4-5pax)', capacity: '4-5 pax', rate: '2,600' },
//     { id: 2, name: 'COTTAGE (6-8pax)', capacity: '6-8 pax', rate: '3,650' },
//     { id: 3, name: 'COTTAGE (9-11pax)', capacity: '9-11 pax', rate: '5,250' },
//     { id: 4, name: 'COTTAGE (12-14pax)', capacity: '12-14 pax', rate: '6,650' },
//     { id: 5, name: 'COTTAGE (15-18pax)', capacity: '15-18 pax', rate: '8,350' },
//   ],
//   conference: [
//     { id: 1, name: 'BENITEZ HALL', capacity: '400 guest', price: '22,200' },
//     { id: 2, name: 'QUEZON HALL MAIN', capacity: '180 guest', price: '7,000' },
//     { id: 3, name: 'QUEZON HALL DOWN', capacity: '40 guest', price: '3,000' },
//     { id: 4, name: 'QUIRINO CONF HALL', capacity: '100 guest', price: '12,350' },
//     { id: 5, name: 'CARLOS P. ROMULO', capacity: '250 guest', price: '30,000' },
//     { id: 6, name: 'QUIRINO MINI HALL', capacity: '27 guest', price: '2,500' },
//     { id: 7, name: 'PAGES CONF HALL', capacity: '20 guest', price: '2,930' },
//     { id: 8, name: 'ABADA HALL', capacity: '20 guest', price: '2,000' },
//     { id: 9, name: 'ORING-AO HALL', capacity: '20 guest', price: '3,000' },
//     { id: 10, name: 'ROXAS AVR', capacity: '400 guest', price: '8,000' },
//     { id: 11, name: 'ALBERT HALL MAIN', capacity: '200 guest', price: '26,000' },
//     { id: 12, name: 'ALBERT HALL (L-R)', capacity: '100 guest', price: '3,000' },
//     { id: 13, name: 'GROUNDS', capacity: 'Whole Day', price: '12,000' },
//     { id: 14, name: 'GROUNDS', capacity: 'Half Day', price: '7,000' },
//   ],
// };


function MainServicesServiceDetail() {
  const { type, id } = useParams();
  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableDates, setAvailableDates] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/facility/get-facility-by-id/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 200 && data.facility) {
          setFacility(data.facility);
        } else {
          setFacility(null);
        }
        setLoading(false);
      })
      .catch(() => {
        setFacility(null);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    fetch(`/api/facility/get-available-dates-by-facility/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 200) {
          setAvailableDates(data.availableDates || []);
        } else {
          setAvailableDates([]);
        }
      })
      .catch(() => setAvailableDates([]));
  }, [id]);

  if (loading) {
    return <section className={styles.serviceDetailSection}><div>Loading...</div></section>;
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

    for (let i = 0; i < firstDayIndex; i++) {
      calendarDays.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      calendarDays.push(i);
    }

    while (calendarDays.length < 42) {
      calendarDays.push(null);
    }

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
      daysOfWeek: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
      calendarDaysGrid: calendarDays,
      reservedDates: reservedDates
    };
  };

  const calendarData = getCalendarData(currentDate);

  const handlePrevMonth = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate.getFullYear(), prevDate.getMonth() - 1, 1);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 1);
      return newDate;
    });
  };

  const getPriceLabel = () => (facility.facilityType === 'CONFERENCE' ? 'Price' : 'Rates per Person');

  const onReserveNow = () => {
    if (isLoggedIn) {
      navigate(`/reservation-form/${type}/${facility._id}`);
    } else {
      navigate('/auth/login');
    }
  };

  return (
    <section className={styles.serviceDetailSection}>
      <h2 className={styles.sectionTitle}>
        {type.toUpperCase()} / DETAIL VIEW
      </h2>

      <div className={styles.detailContentContainer}>
        <div className={styles.detailCard}>
          <div
            className={styles.detailImage}
            style={{ backgroundImage: `url(${facility.image || placeholderImage})` }}
          ></div>
          <h3 className={styles.detailName}>{facility.name}</h3>
          <p className={styles.detailCapacity}>
            Capacity: {facility.capacity}{facility.facilityType === 'DORMITORY' ? ' pax' : ''}
          </p>
          <p className={styles.detailRate}>{getPriceLabel()} : ₱ {facility.ratePerPerson || facility.price}</p>
          <button className={styles.reserveButton} onClick={onReserveNow}>
            Reserve Now!
          </button>
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
            {/* Day Headers */}
            {calendarData.daysOfWeek.map(day => (
              <div key={day} className={styles.calendarDayHeader}>{day}</div>
            ))}
            {/* Dates */}
            {calendarData.calendarDaysGrid.map((date, index) => {
              const isToday = date &&
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