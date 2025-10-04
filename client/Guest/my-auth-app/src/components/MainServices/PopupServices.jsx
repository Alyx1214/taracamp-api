import React, { useState, useEffect } from 'react';
import styles from './PopupServices.module.css';

const PopupServices = ({ isOpen, onClose, onSubmit }) => {
  const [selectedService, setSelectedService] = useState('Dormitory');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(1);

  const serviceTypes = ['Dormitory', 'Cottage', 'Conference'];

  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    setCheckInDate(today.toISOString().split('T')[0]);
    setCheckOutDate(tomorrow.toISOString().split('T')[0]);
  }, []);

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

  const incrementCount = (type) => {
    if (type === 'adults') setAdults((prev) => prev + 1);
    if (type === 'children') setChildren((prev) => prev + 1);
  };

  const decrementCount = (type) => {
    if (type === 'adults' && adults > 1) setAdults((prev) => prev - 1);
    if (type === 'children' && children > 0) setChildren((prev) => prev - 1);
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
                onClick={() => setSelectedService(service)}
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
              <div className={styles.dateField}>
                <span className={styles.calendarIcon} aria-hidden>
                  📅
                </span>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
                <div>
                  <div className={styles.dateValue}>{formatDate(checkInDate)}</div>
                  <div className={styles.dateDay}>{getDayOfWeek(checkInDate)}</div>
                </div>
              </div>
            </div>

            <div className={styles.dateInput}>
              <label>Check-out</label>
              <div className={styles.dateField}>
                <span className={styles.calendarIcon} aria-hidden>
                  📅
                </span>
                <input
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  min={checkInDate || new Date().toISOString().split('T')[0]}
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
                <span className={styles.count}>{adults}</span>
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
                <span className={styles.count}>{children}</span>
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
