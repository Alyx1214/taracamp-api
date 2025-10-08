import React, { useEffect, useRef, useState } from 'react';
import Calendar from './Calendar'; 
import styles from './Controls.module.css';

const Controls = ({ facilityType = 'All', onApplyFilters }) => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const [checkInDate, setCheckInDate] = useState(today);
  const [checkOutDate, setCheckOutDate] = useState(tomorrow);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(1);
  const [showCheckInCalendar, setShowCheckInCalendar] = useState(false);
  const [showCheckOutCalendar, setShowCheckOutCalendar] = useState(false);
  const lastAppliedFiltersRef = useRef(null);

  const toISODate = (d) => {
    const date = new Date(d);
    if (Number.isNaN(date)) return undefined;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDate = (date) => {
  const d = new Date(date);
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    return {
      formatted: `${day} ${month} ${year}`,
      dayName: dayName
    };
  };


  useEffect(() => {
    if (!onApplyFilters) return;

    const totalGuests = Number(adults) + Number(children);
    const nextFilters = {
      type: facilityType === 'All' ? null : facilityType,
      capacity: Number.isFinite(totalGuests) ? totalGuests : undefined,
      checkInDate: toISODate(checkInDate),
      checkOutDate: toISODate(checkOutDate),
    };

    const prev = lastAppliedFiltersRef.current;
    const changed =
      !prev ||
      prev.type !== nextFilters.type ||
      prev.capacity !== nextFilters.capacity ||
      prev.checkInDate !== nextFilters.checkInDate ||
      prev.checkOutDate !== nextFilters.checkOutDate;

    if (!changed) return;

    lastAppliedFiltersRef.current = nextFilters;
    onApplyFilters(nextFilters);
  }, [adults, children, checkInDate, checkOutDate, facilityType, onApplyFilters]);

  const handleAdultDecrease = () => {
    if (adults > 1) setAdults(adults - 1);
  };

  const handleAdultIncrease = () => {
    setAdults(adults + 1);
  };

  const handleChildDecrease = () => {
    if (children > 0) setChildren(children - 1);
  };

  const handleChildIncrease = () => {
    setChildren(children + 1);
  };

  const handleCheckInDateSelect = (date) => {
    setCheckInDate(date);
    setShowCheckInCalendar(false);
  };

  const handleCheckOutDateSelect = (date) => {
    setCheckOutDate(date);
    setShowCheckOutCalendar(false);
  };

  const checkInDateInfo = formatDate(checkInDate);
  const checkOutDateInfo = formatDate(checkOutDate);

  return (
    <div className={styles.controlsContainer}>
      {/* Check-in Date */}
      <div
          className={styles.dateControl}
          onClick={() => {
            setShowCheckInCalendar(!showCheckInCalendar);
            setShowCheckOutCalendar(false); 
          }}
        >
        <div className={styles.calendarIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
        <div className={styles.dateInfo}>
          <div className={styles.dateMain}>{checkInDateInfo.formatted}</div>
          <div className={styles.dateDay}>{checkInDateInfo.dayName}</div>
        </div>
        {showCheckInCalendar && (
          <div className={styles.calendarDropdown}>
            <Calendar 
              selectedDate={checkInDate}
              onDateSelect={handleCheckInDateSelect}
              onClose={() => setShowCheckInCalendar(false)}
            />
          </div>
        )}
      </div>

      {/* Check-out Date */}
        <div
          className={styles.dateControl}
          onClick={() => {
            setShowCheckOutCalendar(!showCheckOutCalendar);
            setShowCheckInCalendar(false); 
          }}
        >
        <div className={styles.calendarIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
        <div className={styles.dateInfo}>
          <div className={styles.dateMain}>{checkOutDateInfo.formatted}</div>
          <div className={styles.dateDay}>{checkOutDateInfo.dayName}</div>
        </div>
        {showCheckOutCalendar && (
          <div className={styles.calendarDropdown}>
            <Calendar 
              selectedDate={checkOutDate}
              onDateSelect={handleCheckOutDateSelect}
              onClose={() => setShowCheckOutCalendar(false)}
              minDate={checkInDate}
            />
          </div>
        )}
      </div>

      {/* Adult Counter */}
      <div className={styles.guestControl}>
        <div className={styles.guestInfo}>
          <div className={styles.guestLabel}>Adult</div>
        </div>
        <div className={styles.counterControls}>
          <button 
            className={`${styles.counterButton} ${adults <= 1 ? styles.disabled : ''}`}
            onClick={handleAdultDecrease}
            disabled={adults <= 1}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
          <span className={styles.counterValue}>{adults}</span>
          <button 
            className={styles.counterButton}
            onClick={handleAdultIncrease}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2"/>
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Child Counter */}
      <div className={styles.guestControl}>
        <div className={styles.guestInfo}>
          <div className={styles.guestLabel}>Child</div>
        </div>
        <div className={styles.counterControls}>
          <button 
            className={`${styles.counterButton} ${children <= 0 ? styles.disabled : ''}`}
            onClick={handleChildDecrease}
            disabled={children <= 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
          <span className={styles.counterValue}>{children}</span>
          <button 
            className={styles.counterButton}
            onClick={handleChildIncrease}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2"/>
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Controls;
