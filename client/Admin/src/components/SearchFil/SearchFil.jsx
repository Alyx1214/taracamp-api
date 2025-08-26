import React, { useState } from "react";
import styles from "./SearchFil.module.css";

export default function SearchFil({ 
  placeholder = "Search", 
  onSearch, 
  onFilter, 
  onApplyFilters,
  filterFields = [] // Array of filter field configurations
}) {
  const [searchValue, setSearchValue] = useState('');
  const [showFilterOverlay, setShowFilterOverlay] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const handleSearch = () => {
    if (onSearch) onSearch(searchValue);
  };

  const handleInputChange = (e) => {
    setSearchValue(e.target.value);
    if (e.target.value === '' && onSearch) {
      onSearch(''); // Clear search
    }
  };

  const openFilterOverlay = () => {
    setShowFilterOverlay(true);
  };

  const closeFilterOverlay = () => {
    setShowFilterOverlay(false);
  };

  const handleApplyFilters = () => {
    if (onApplyFilters) {
      onApplyFilters(filterValues);
    }
    closeFilterOverlay();
  };

  const handleClearFilters = () => {
    setFilterValues({});
    console.log('Filters Cleared!');
  };

  const handleFilterValueChange = (fieldName, value) => {
    setFilterValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  return (
    <div className={styles.searchFilterContainer}>
      <div className={styles.searchFilter}>
        <input
          type="text"
          placeholder={placeholder}
          className={styles.searchInput}
          value={searchValue}
          onChange={handleInputChange}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className={styles.searchButton} onClick={handleSearch}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-search">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
        <button className={styles.filterButton} onClick={openFilterOverlay}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-filter">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
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
              {filterFields.map((field, index) => (
                <div key={index} className={styles.overlayInputRow}>
                  <label htmlFor={field.name}>{field.label}:</label>
                  <input
                    type={field.type || "text"}
                    id={field.name}
                    placeholder={field.placeholder || ""}
                    className={styles.overlayInput}
                    value={filterValues[field.name] || ''}
                    onChange={(e) => handleFilterValueChange(field.name, e.target.value)}
                    min={field.min || undefined}
                    max={field.max || undefined}
                  />
                </div>
              ))}
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