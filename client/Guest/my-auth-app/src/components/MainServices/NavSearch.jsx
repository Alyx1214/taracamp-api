import React, { useState, useEffect} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './NavSearch.module.css';

function MainServicesNavSearch({ onSearch, onClearSearch, onApplyFilters }) {
  const [searchValue, setSearchValue] = useState('');
  const location = useLocation();
  const base = location.pathname.startsWith('/user/services') ? '/user/services' : '/services';

  const handleSearch = () => {
    onSearch(searchValue);
  };

  useEffect(() => {
    setSearchValue('');
  }, [location.pathname]);

  const handleInputChange = (e) => {
    setSearchValue(e.target.value);
    if (e.target.value === '') {
      onClearSearch(); 
    }
  };

  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [showFilterOverlay, setShowFilterOverlay] = useState(false);
  const openFilterOverlay = () => {
    setShowFilterOverlay(true);
  };

  const closeFilterOverlay = () => {
    setShowFilterOverlay(false);
  };

  const handleApplyFilters = () => {
    onApplyFilters({
      minPrice,
      maxPrice,
      capacity,
      checkInDate,
      checkOutDate
    });
    
    closeFilterOverlay();
  };

  const handleClearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setCapacity('');
    setCheckInDate('');
    setCheckOutDate('');
    console.log('Filters Cleared!');
  };

  return (
    <div className={styles.navAndSearchContainer}>
      <div className={styles.navTabs}>
        <NavLink to={`${base}/dormitories`} className={({ isActive }) => `${styles.navTab} ${isActive ? styles.activeTab : ''}`} end>
          Dormitory
        </NavLink>
        <NavLink to={`${base}/cottages`} className={({ isActive }) => `${styles.navTab} ${isActive ? styles.activeTab : ''}`} end>
          Cottage
        </NavLink>
        <NavLink to={`${base}/conference`} className={({ isActive }) => `${styles.navTab} ${isActive ? styles.activeTab : ''}`} end>
          Conference
        </NavLink>
        <NavLink to={`${base}/add-ons`} className={({ isActive }) => `${styles.navTab} ${isActive ? styles.activeTab : ''}`} end>
          Add-ons
        </NavLink>
      </div>

      <div className={styles.searchFilter}>
        <input
          type="text"
          placeholder="Search by Name"
          className={styles.searchInput}
          value={searchValue}
          onChange={handleInputChange}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className={styles.searchButton} onClick={handleSearch}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </button>
        <button className={styles.filterButton} onClick={openFilterOverlay}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-filter"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
        </button>
      </div>

      {showFilterOverlay && (
        <div className={styles.filterOverlayBackdrop} onClick={closeFilterOverlay}>
          <div className={styles.filterOverlayContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.overlayCloseTopButton} onClick={closeFilterOverlay}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <h3>Apply Filters</h3>
            <div className={styles.overlayInputsGroup}>
              <div className={styles.overlayInputRow}>
                <label htmlFor="minPrice">Min Price:</label>
                <input
                  type="number"
                  id="minPrice"
                  placeholder="ex.500"
                  className={styles.overlayInput}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  min="0"
                />
              </div>
              <div className={styles.overlayInputRow}>
                <label htmlFor="maxPrice">Max Price:</label>
                <input
                  type="number"
                  id="maxPrice"
                  placeholder="ex.10000"
                  className={styles.overlayInput}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  min="0"
                />
              </div>
              <div className={styles.overlayInputRow}>
                <label htmlFor="capacity">Capacity:</label>
                <input
                  type="number"
                  id="capacity"
                  placeholder="Guests"
                  className={styles.overlayInput}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  min="1"
                />
              </div>
              <div className={styles.overlayInputRow}>
                <label htmlFor="checkIn">Check-in:</label>
                <input
                  type="date"
                  id="checkIn"
                  className={styles.overlayInput}
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                />
              </div>
              <div className={styles.overlayInputRow}>
                <label htmlFor="checkOut">Check-out:</label>
                <input
                  type="date"
                  id="checkOut"
                  className={styles.overlayInput}
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.overlayButtons}>
              <button className={styles.overlayClearButton} onClick={handleClearFilters}>Clear All</button>
              <button className={styles.overlayApplyButton} onClick={handleApplyFilters}>Apply Filters</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainServicesNavSearch;