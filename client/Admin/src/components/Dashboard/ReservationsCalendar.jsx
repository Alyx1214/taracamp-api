import { useEffect, useMemo, useState } from 'react';
import styles from './ReservationsCalendar.module.css';
import { getReservationsForCalendar } from '../../apis/dashboardApi';

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

  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();   // 0-indexed
  const monthForApi = monthIndex + 1;          // API expects 1-indexed

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

  useEffect(() => {
    const fetchMonth = async () => {
      setLoading(true);
      try {
        const res = await getReservationsForCalendar(year, monthForApi);
        const rows = Array.isArray(res?.reservations) ? res.reservations : [];

        const map = new Map();
        for (const r of rows) {
          const dt = new Date(r.dateOfArrival);
          if (Number.isNaN(dt.getTime())) continue;
          const day = dt.getDate();

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
        setDayCounts(map);
      } catch (e) {
        console.error('Error loading reservations for calendar:', e);
        setDayCounts(new Map());
      } finally {
        setLoading(false);
      }
    };
    fetchMonth();
  }, [year, monthForApi]);

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
            return (
              <div
                key={idx}
                className={`${styles.dayCell} ${day ? styles.hasDay : styles.emptyDay} ${isToday(day) ? styles.today : ''} ${hasAny ? styles.highlighted : ''}`}
                title={counts ? `Total: ${counts.total} — Confirmed: ${counts.confirmed}, Cancelled: ${counts.cancelled}` : undefined}
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
