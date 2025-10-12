import React, { useState, useEffect, useRef } from 'react';
import styles from './PopupServices.module.css';

const PopupServices = ({ isOpen, onClose, onSubmit, sharedFilters, updateSharedFilters }) => {
  const [selectedService, setSelectedService] = useState(sharedFilters?.serviceType || 'Dormitory');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [adults, setAdults] = useState(sharedFilters?.adults || 1);
  const [children, setChildren] = useState(sharedFilters?.children || 1);
  
  const checkInInputRef = useRef(null);
  const checkOutInputRef = useRef(null);

  const serviceTypes = ['Dormitory', 'Cottage', 'Conference'];

  useEffect(() => {
    // Use shared state if available, otherwise use default values
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (sharedFilters?.checkInDate) {
      setCheckInDate(sharedFilters.checkInDate.toISOString().split('T')[0]);
    } else {
      setCheckInDate(today.toISOString().split('T')[0]);
    }

    if (sharedFilters?.checkOutDate) {
      setCheckOutDate(sharedFilters.checkOutDate.toISOString().split('T')[0]);
    } else {
      setCheckOutDate(tomorrow.toISOString().split('T')[0]);
    }

    if (sharedFilters?.adults !== undefined) {
      setAdults(sharedFilters.adults);
    }

    if (sharedFilters?.children !== undefined) {
      setChildren(sharedFilters.children);
    }

    if (sharedFilters?.serviceType) {
      setSelectedService(sharedFilters.serviceType);
    }
  }, [sharedFilters]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDayOfWeek = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  // Input validation and handlers for adults and children
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

  const incrementCount = (type) => {
    if (type === 'adults') {
      setAdults((prev) => {
        const newValue = prev + 1;
        updateSharedFilters?.({ adults: newValue });
        return newValue;
      });
    }
    if (type === 'children') {
      setChildren((prev) => {
        const newValue = prev + 1;
        updateSharedFilters?.({ children: newValue });
        return newValue;
      });
    }
  };

  const decrementCount = (type) => {
    if (type === 'adults' && adults > 1) {
      setAdults((prev) => {
        const newValue = prev - 1;
        updateSharedFilters?.({ adults: newValue });
        return newValue;
      });
    }
    if (type === 'children' && children > 0) {
      setChildren((prev) => {
        const newValue = prev - 1;
        updateSharedFilters?.({ children: newValue });
        return newValue;
      });
    }
  };

  const handleSearch = () => {
    const payload = {
      serviceType: selectedService, // 'Dormitory' | 'Cottage' | 'Conference'
      checkIn: checkInDate,
      checkOut: checkOutDate,
      adults,
      children,
    };
    onSubmit?.(payload);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.popupOverlay}>
      <div className={styles.popupContainer}>
        <div className={styles.popupHeader}>
          <h2>Book Your Stay</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.popupContent}>
          {/* Service Type Selection */}
          <div className={styles.serviceTypes}>
            {serviceTypes.map((service) => (
              <button
                key={service}
                className={`${styles.serviceBtn} ${
                  selectedService === service ? styles.active : ''
                }`}
                onClick={() => {
                  setSelectedService(service);
                  updateSharedFilters?.({ serviceType: service });
                }}
                type="button"
              >
                {service}
              </button>
            ))}
          </div>

          {/* Date Selection */}
          <div className={styles.dateSection}>
            <div className={styles.dateInput}>
              <label>Check-in</label>
              <div 
                className={styles.dateField}
                onClick={() => {
                  // Trigger the date input click
                  if (checkInInputRef.current) {
                    checkInInputRef.current.showPicker?.() || checkInInputRef.current.click();
                  }
                }}
              >
                <span className={styles.calendarIcon} aria-hidden>
                  📅
                </span>
                <input
                  ref={checkInInputRef}
                  type="date"
                  value={checkInDate}
                  onChange={(e) => {
                    setCheckInDate(e.target.value);
                    updateSharedFilters?.({ checkInDate: new Date(e.target.value) });
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  style={{ opacity: 0, position: 'absolute', pointerEvents: 'none' }}
                />
                <div>
                  <div className={styles.dateValue}>{formatDate(checkInDate)}</div>
                  <div className={styles.dateDay}>{getDayOfWeek(checkInDate)}</div>
                </div>
              </div>
            </div>

            <div className={styles.dateInput}>
              <label>Check-out</label>
              <div 
                className={styles.dateField}
                onClick={() => {
                  // Trigger the date input click
                  if (checkOutInputRef.current) {
                    checkOutInputRef.current.showPicker?.() || checkOutInputRef.current.click();
                  }
                }}
              >
                <span className={styles.calendarIcon} aria-hidden>
                  📅
                </span>
                <input
                  ref={checkOutInputRef}
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => {
                    setCheckOutDate(e.target.value);
                    updateSharedFilters?.({ checkOutDate: new Date(e.target.value) });
                  }}
                  min={checkInDate || new Date().toISOString().split('T')[0]}
                  style={{ opacity: 0, position: 'absolute', pointerEvents: 'none' }}
                />
                <div>
                  <div className={styles.dateValue}>{formatDate(checkOutDate)}</div>
                  <div className={styles.dateDay}>{getDayOfWeek(checkOutDate)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Guest Selection */}
          <div className={styles.guestSection}>
            <div className={styles.guestInput}>
              <label>Adult</label>
              <div className={styles.counter}>
                <button
                  className={styles.counterBtn}
                  onClick={() => decrementCount('adults')}
                  disabled={adults <= 1}
                  type="button"
                >
                  −
                </button>
                <input
                  type="number"
                  className={styles.countInput}
                  value={adults}
                  onChange={handleAdultChange}
                  onBlur={handleAdultBlur}
                  min="1"
                />
                <button
                  className={styles.counterBtn}
                  onClick={() => incrementCount('adults')}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>

            <div className={styles.guestInput}>
              <label>Child</label>
              <div className={styles.counter}>
                <button
                  className={styles.counterBtn}
                  onClick={() => decrementCount('children')}
                  disabled={children <= 0}
                  type="button"
                >
                  −
                </button>
                <input
                  type="number"
                  className={styles.countInput}
                  value={children}
                  onChange={handleChildChange}
                  onBlur={handleChildBlur}
                  min="0"
                />
                <button
                  className={styles.counterBtn}
                  onClick={() => incrementCount('children')}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Search Button */}
          <button className={styles.searchBtn} onClick={handleSearch} type="button">
            SEARCH
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopupServices;
