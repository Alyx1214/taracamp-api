import React, { useEffect, useRef, useState, useCallback } from 'react';
import Calendar from './Calendar'; 
import styles from './Controls.module.css';

const Controls = ({ facilityType = 'All', onApplyFilters, sharedFilters, updateSharedFilters }) => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  // Use shared state if available, otherwise fall back to local state
  const [checkInDate, setCheckInDate] = useState(sharedFilters?.checkInDate || today);
  const [checkOutDate, setCheckOutDate] = useState(sharedFilters?.checkOutDate || tomorrow);
  const [adults, setAdults] = useState(sharedFilters?.adults || 1);
  const [children, setChildren] = useState(sharedFilters?.children || 0);
  const [showCheckInCalendar, setShowCheckInCalendar] = useState(false);
  const [showCheckOutCalendar, setShowCheckOutCalendar] = useState(false);
  const lastAppliedFiltersRef = useRef(null);
  const debounceTimeoutRef = useRef(null);

  const toISODate = (d) => {
    const date = d instanceof Date ? new Date(d.getTime()) : new Date(d);
    if (Number.isNaN(date.getTime())) return undefined;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDate = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return { formatted: '—', dayName: '' };
    return {
      formatted: `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getFullYear()}`,
      dayName: d.toLocaleDateString('en-US', { weekday: 'long' })
    };
  };

  // Debounced filter application to prevent rate limiting
  const applyFiltersDebounced = useCallback(() => {
    if (!onApplyFilters) return;

    const adultCount = adults === '' ? 1 : Number(adults);
    const childCount = children === '' ? 0 : Number(children);
    const totalGuests = adultCount + childCount;
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

  useEffect(() => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced execution
    debounceTimeoutRef.current = setTimeout(() => {
      applyFiltersDebounced();
    }, 300); // 300ms debounce delay

    // Cleanup timeout on unmount
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [applyFiltersDebounced]);

  // Sync with shared state changes
  useEffect(() => {
    if (sharedFilters) {
      if (sharedFilters.checkInDate && sharedFilters.checkInDate !== checkInDate) {
        setCheckInDate(sharedFilters.checkInDate);
      }
      if (sharedFilters.checkOutDate && sharedFilters.checkOutDate !== checkOutDate) {
        setCheckOutDate(sharedFilters.checkOutDate);
      }
      if (sharedFilters.adults !== undefined && sharedFilters.adults !== adults) {
        setAdults(sharedFilters.adults);
      }
      if (sharedFilters.children !== undefined && sharedFilters.children !== children) {
        setChildren(sharedFilters.children);
      }
    }
  }, [sharedFilters, checkInDate, checkOutDate, adults, children]);

  // Input validation and handlers
  const handleAdultChange = (e) => {
    const value = e.target.value;
    // Allow empty string for better typing experience
    if (value === '') {
      setAdults('');
      updateSharedFilters?.({ adults: '' });
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1) {
      setAdults(num);
      updateSharedFilters?.({ adults: num });
    }
  };

  const handleChildChange = (e) => {
    const value = e.target.value;
    // Allow empty string for better typing experience
    if (value === '') {
      setChildren('');
      updateSharedFilters?.({ children: '' });
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setChildren(num);
      updateSharedFilters?.({ children: num });
    }
  };

  const handleAdultBlur = () => {
    // Ensure minimum value on blur
    if (adults === '' || adults < 1) {
      setAdults(1);
      updateSharedFilters?.({ adults: 1 });
    }
  };

  const handleChildBlur = () => {
    // Ensure minimum value on blur
    if (children === '' || children < 0) {
      setChildren(0);
      updateSharedFilters?.({ children: 0 });
    }
  };

  const handleAdultDecrease = () => {
    if (adults > 1) {
      setAdults(adults - 1);
      updateSharedFilters?.({ adults: adults - 1 });
    }
  };

  const handleAdultIncrease = () => {
    setAdults(adults + 1);
    updateSharedFilters?.({ adults: adults + 1 });
  };

  const handleChildDecrease = () => {
    if (children > 0) {
      setChildren(children - 1);
      updateSharedFilters?.({ children: children - 1 });
    }
  };

  const handleChildIncrease = () => {
    setChildren(children + 1);
    updateSharedFilters?.({ children: children + 1 });
  };
  
  const handleCheckInDateSelect = (picked) => {
    setCheckInDate(picked.date); 
    updateSharedFilters?.({ checkInDate: picked.date });
    setShowCheckInCalendar(false);
  };

  const handleCheckOutDateSelect = (picked) => {
    setCheckOutDate(picked.date); 
    updateSharedFilters?.({ checkOutDate: picked.date });
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
          <input
            type="number"
            className={styles.counterInput}
            value={adults}
            onChange={handleAdultChange}
            onBlur={handleAdultBlur}
            min="1"
          />
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
          <input
            type="number"
            className={styles.counterInput}
            value={children}
            onChange={handleChildChange}
            onBlur={handleChildBlur}
            min="0"
          />
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
