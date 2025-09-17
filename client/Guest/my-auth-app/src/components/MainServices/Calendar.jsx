import React from 'react';
import styles from './Calendar.module.css';

const Calendar = ({ currentDate, onPrevMonth, onNextMonth, calendarData, onDateClick }) => {
  return (
    <div className={styles.reservationsCalendar}>
      <h4 className={styles.calendarHeader}>Reservations Calendar</h4>
      <div className={styles.calendarMonthNav}>
        <span className={styles.navArrow} onClick={onPrevMonth}>&lt;</span>
        <span className={styles.currentMonth}>{calendarData.monthDisplay}</span>
        <span className={styles.navArrow} onClick={onNextMonth}>&gt;</span>
      </div>
      <div className={styles.calendarGrid}>
        {calendarData.daysOfWeek.map((day) => (
          <div key={day} className={styles.calendarDayHeader}>{day}</div>
        ))}
        {calendarData.calendarDaysGrid.map((day, index) => {
          const isToday =
            day &&
            day === new Date().getDate() &&
            currentDate.getMonth() === new Date().getMonth() &&
            currentDate.getFullYear() === new Date().getFullYear();

          let isReserved = false;
          if (day) {
            const y = currentDate.getFullYear();
            const m = String(currentDate.getMonth() + 1).padStart(2, '0');
            const d = String(day).padStart(2, '0');
            const ymd = `${y}-${m}-${d}`;

            if (calendarData.reservedSet && typeof calendarData.reservedSet.has === 'function') {
              isReserved = calendarData.reservedSet.has(ymd);
            } else if (Array.isArray(calendarData.reservedDates)) {
              isReserved = calendarData.reservedDates.includes(day) || calendarData.reservedDates.includes(ymd);
            } else if (Array.isArray(calendarData.reservedDatesArr)) {
              isReserved = calendarData.reservedDatesArr.includes(ymd);
            }
          }

          return (
            <div
              key={index}
              className={`${styles.calendarDate} ${isReserved ? styles.reservedDate : ''} ${isToday ? styles.currentDay : ''} ${day ? styles.clickable : ''}`}
              onClick={day ? () => onDateClick && onDateClick(day, currentDate) : undefined}
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