import { useState } from 'react';
import styles from './ReservationsCalendar.module.css';

const ReservationsCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2023, 4, 1)); // May 2023
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Convert to Monday = 0
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };
  
  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };
  
  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  };
  
  // Sample data for highlighted dates (you can replace with real data)
  const highlightedDates = [3, 10, 15, 22, 30, 31];
  
  const days = getDaysInMonth(currentDate);
  
  return (
    <div className={styles.calendarContainer}>
      <div className={styles.calendarHeader}>
        <h3 className={styles.calendarTitle}>Reservations Calendar</h3>
        <div className={styles.monthNavigation}>
          <button 
            className={styles.navButton} 
            onClick={() => navigateMonth(-1)}
          >
            ←
          </button>
          <span className={styles.monthYear}>
            {months[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button 
            className={styles.navButton} 
            onClick={() => navigateMonth(1)}
          >
            →
          </button>
        </div>
      </div>
      
      <div className={styles.calendar}>
        <div className={styles.weekdaysHeader}>
          {weekdays.map(day => (
            <div key={day} className={styles.weekday}>
              {day}
            </div>
          ))}
        </div>
        
        <div className={styles.daysGrid}>
          {days.map((day, index) => (
            <div 
              key={index} 
              className={`${styles.dayCell} 
                ${day ? styles.hasDay : styles.emptyDay}
                ${isToday(day) ? styles.today : ''}
                ${day && highlightedDates.includes(day) ? styles.highlighted : ''}
              `}
            >
              {day}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReservationsCalendar;
