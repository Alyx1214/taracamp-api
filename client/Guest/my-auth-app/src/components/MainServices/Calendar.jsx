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
  reservedDates = [],
  maxMonthsAhead = 2  // Default to 2 months restriction
}) => {
  const selected = parseLooseDate(selectedDate);
  const [viewDate, setViewDate] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const minD = minDate ? parseLooseDate(minDate) : null;
  
  // Calculate restricted date range (today to 2 months from today - these will be grayed out)
  const today = new Date();
  const restrictedEndDate = useMemo(() => {
    const endDate = new Date(today.getFullYear(), today.getMonth() + maxMonthsAhead, today.getDate());
    return endDate;
  }, [maxMonthsAhead]);
  
  const minAllowedDate = useMemo(() => {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }, [today]);

  const reservedSet = useMemo(() => {
    const s = new Set();
    // Ensure reservedDates is an array
    const datesArray = Array.isArray(reservedDates) ? reservedDates : [];
    
    for (const r of datesArray) {
      if (r instanceof Date) {
        const y = r.getFullYear();
        const m = String(r.getMonth() + 1).padStart(2, '0');
        const d = String(r.getDate()).padStart(2, '0');
        s.add(`${y}-${m}-${d}`);
      } else if (typeof r === 'string' && r.trim()) {
        // Ensure the string is in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(r.trim())) {
          s.add(r.trim());
        } else {
          // Try to parse and convert to YYYY-MM-DD format
          try {
            const d = parseLooseDate(r);
            if (d && !isNaN(d.getTime())) {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              s.add(`${y}-${m}-${dd}`);
            }
          } catch (e) {
            // Skip invalid dates
            console.warn('Invalid date format in reservedDates:', r);
          }
        }
      }
    }
    return s;
  }, [reservedDates]);

  const data = useMemo(() => buildCalendarData(viewDate, reservedSet), [viewDate, reservedSet]);

  const isSameDay = (y, m, d, ref) => y === ref.getFullYear() && m === ref.getMonth() && d === ref.getDate();

  const goPrev = (e) => {
    e?.stopPropagation();
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const goNext = (e) => {
    e?.stopPropagation();
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const clickDay = (day) => {
    if (!day) return;
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const chosen = new Date(y, m, day);

    // Check if date is before today
    if (chosen < minAllowedDate) {
      return;
    }

    // Check if date is within the restricted period (within 2 months - these should be grayed out)
    if (chosen <= restrictedEndDate) {
      return;
    }

    // Check additional minimum date restriction if provided
    if (minD && chosen < new Date(minD.getFullYear(), minD.getMonth(), minD.getDate())) {
      return;
    }

    const ymd = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check if date is reserved
    if (reservedSet.has(ymd)) {
      return;
    }

    const formatted = formatDMonYYYY(chosen);

    if (onDateSelect) onDateSelect({ date: chosen, ymd, formatted });
    if (onClose) onClose();
  };

  return (
    <div className={styles.reservationsCalendar} onClick={(e) => e.stopPropagation()}>
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
          const beforeToday = chosen && chosen < minAllowedDate; 
          const withinRestrictedPeriod = chosen && chosen <= restrictedEndDate;
          const beforeMin = minD && chosen && chosen < new Date(minD.getFullYear(), minD.getMonth(), minD.getDate());
          // Only mark as restricted if NOT reserved (reserved dates should show as red, not gray)
          const isRestricted = !isReserved && (beforeToday || withinRestrictedPeriod);

          const clickable = !!day && !isReserved && !beforeMin && !isRestricted;

          // Build className array, filtering out empty strings
          // Reserved dates should always show as red, even if they're also restricted
          const classNames = [
            styles.calendarDate,
            isReserved && styles.reservedDate,
            isToday && styles.currentDay,
            clickable && styles.clickable,
            isRestricted && styles.restrictedDate
          ].filter(Boolean);

          // Apply inline styles for reserved dates to ensure they're red
          const inlineStyle = isReserved ? {
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            fontWeight: '700',
            border: '2px solid #ef4444',
            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)',
            cursor: 'not-allowed'
          } : {};

          return (
            <div
              key={idx}
              className={classNames.join(' ')}
              style={inlineStyle}
              onClick={
                clickable
                  ? () => clickDay(day)
                  : undefined
              }
              title={
                isReserved ? 'Reserved' : 
                beforeMin ? 'Unavailable' : 
                isRestricted ? 'Within 2-month restriction period' : 
                day ? 'Select' : ''
              }
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
