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
              className={`${styles.calendarDate} ${isReserved ? styles.reservedDate : ''} ${isToday ? styles.currentDay : ''} ${date ? styles.clickable : ''}`}
              onClick={date ? () => onDateClick && onDateClick(date, currentDate) : undefined}
            >
              {date || ''}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;