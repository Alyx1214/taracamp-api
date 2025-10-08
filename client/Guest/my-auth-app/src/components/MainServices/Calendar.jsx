import React, { useMemo, useState } from 'react';
import styles from './Calendar.module.css';

function parseLooseDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatDMonYYYY(date) {
  return `${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`;
}

function buildCalendarData(viewDate, reservedSet) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); 
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); 
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const grid = [];
  for (let i = 0; i < startWeekday; i++) grid.push('');
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push('');

  const monthDisplay = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return {
    monthDisplay,
    daysOfWeek,
    calendarDaysGrid: grid,
    reservedSet: reservedSet || new Set()
  };
}

const Calendar = ({ 
  selectedDate,             
  onDateSelect,             
  onClose,                  
  minDate,                  
  reservedDates = []        
}) => {
  const selected = parseLooseDate(selectedDate);
  const [viewDate, setViewDate] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const minD = minDate ? parseLooseDate(minDate) : null;

  const reservedSet = useMemo(() => {
    const s = new Set();
    for (const r of reservedDates) {
      if (r instanceof Date) {
        const y = r.getFullYear();
        const m = String(r.getMonth() + 1).padStart(2, '0');
        const d = String(r.getDate()).padStart(2, '0');
        s.add(`${y}-${m}-${d}`);
      } else if (typeof r === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(r)) s.add(r);
        else {
          const d = parseLooseDate(r);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          s.add(`${y}-${m}-${dd}`);
        }
      }
    }
    return s;
  }, [reservedDates]);

  const data = useMemo(() => buildCalendarData(viewDate, reservedSet), [viewDate, reservedSet]);

  const today = new Date();
  const isSameDay = (y, m, d, ref) => y === ref.getFullYear() && m === ref.getMonth() && d === ref.getDate();

  const goPrev = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNext = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const clickDay = (day) => {
    if (!day) return;
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const chosen = new Date(y, m, day);

    if (minD && chosen < new Date(minD.getFullYear(), minD.getMonth(), minD.getDate())) {
      return;
    }

    if (onDateSelect) onDateSelect(formatDMonYYYY(chosen));
    if (onClose) onClose();
  };

  return (
    <div className={styles.reservationsCalendar}>
      <h4 className={styles.calendarHeader}>Reservations Calendar</h4>

      <div className={styles.calendarMonthNav}>
        <span className={styles.navArrow} onClick={goPrev}>&lt;</span>
        <span className={styles.currentMonth}>{data.monthDisplay}</span>
        <span className={styles.navArrow} onClick={goNext}>&gt;</span>
      </div>

      <div className={styles.calendarGrid}>
        {data.daysOfWeek.map((d) => (
          <div key={d} className={styles.calendarDayHeader}>{d}</div>
        ))}

        {data.calendarDaysGrid.map((day, idx) => {
          const y = viewDate.getFullYear();
          const m = viewDate.getMonth();
          const isToday =
            day &&
            isSameDay(y, m, day, today);

          let isReserved = false;
          if (day) {
            const ymd = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            isReserved = data.reservedSet.has(ymd);
          }

          const chosen = day ? new Date(y, m, day) : null;
          const todayFloor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const beforeToday = chosen && chosen < todayFloor; 
          const beforeMin = minD && chosen && chosen < new Date(minD.getFullYear(), minD.getMonth(), minD.getDate());


          const clickable = !!day && !isReserved && !beforeMin;

          return (
            <div
              key={idx}
              className={[
                styles.calendarDate,
                isReserved ? styles.reservedDate : '',
                isToday ? styles.currentDay : '',
                clickable ? styles.clickable : '',
                beforeToday ? styles.pastDate : ''
              ].join(' ')}
              onClick={
                clickable && !beforeToday
                  ? () => clickDay(day)
                  : undefined
              }
              title={isReserved ? 'Reserved' : beforeMin ? 'Unavailable' : day ? 'Select' : ''}
            >
              {day || ''}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;
