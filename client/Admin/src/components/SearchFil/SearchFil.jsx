import React, { useState, useEffect, useRef } from "react";
import styles from "./SearchFil.module.css";

export default function SearchFil({ 
  placeholder = "Search", 
  onSearch, 
  onApplyFilters,
  filterFields = [],
  initialSearchValue = "",
  initialFilterValues = {}
}) {
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [showFilterOverlay, setShowFilterOverlay] = useState(false);
  const [filterValues, setFilterValues] = useState(initialFilterValues);
  const [dateError, setDateError] = useState("");
  const prevFilterValuesRef = useRef(initialFilterValues);

  const handleSearch = () => {
    if (onSearch) onSearch(searchValue);
  };

  const handleInputChange = (e) => {
    setSearchValue(e.target.value);
    if (e.target.value === "" && onSearch) {
      onSearch(""); // Clear search
    }
  };

  const validateDates = () => {
    const startDate = filterValues.startDate;
    const endDate = filterValues.endDate;
    
    if (startDate && endDate) {
      if (new Date(endDate) < new Date(startDate)) {
        setDateError("End date cannot be earlier than start date");
        return false;
      }
    }
    setDateError("");
    return true;
  };

  const handleApplyFilters = () => {
    if (!validateDates()) {
      return; // Don't apply filters if dates are invalid
    }
    if (onApplyFilters) {
      onApplyFilters(filterValues);
    }
    setShowFilterOverlay(false);
    setDateError(""); // Clear error when closing
  };

  const handleClearFilters = () => {
    setFilterValues({});
    setDateError(""); // Clear error when clearing filters
    if (onApplyFilters) onApplyFilters({});
  };

  // Update internal state when props change (e.g., when navigating back)
  useEffect(() => {
    setSearchValue(initialSearchValue);
  }, [initialSearchValue]);

  // Only update filterValues if the actual values changed (deep comparison)
  useEffect(() => {
    const prevValues = prevFilterValuesRef.current;
    const currentValues = initialFilterValues || {};
    
    // Check if values actually changed by comparing JSON strings
    const prevStr = JSON.stringify(prevValues);
    const currentStr = JSON.stringify(currentValues);
    
    if (prevStr !== currentStr) {
      setFilterValues(currentValues);
      prevFilterValuesRef.current = currentValues;
    }
  }, [initialFilterValues]);

  // Close overlay when component unmounts (e.g., when navigating away)
  useEffect(() => {
    return () => {
      setShowFilterOverlay(false);
    };
  }, []);

  const handleFilterValueChange = (fieldName, value) => {
    setFilterValues((prev) => {
      const newValues = {
        ...prev,
        [fieldName]: value,
      };
      
      // Validate dates when either date changes
      if (fieldName === "startDate" || fieldName === "endDate") {
        const startDate = fieldName === "startDate" ? value : newValues.startDate;
        const endDate = fieldName === "endDate" ? value : newValues.endDate;
        
        if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
          setDateError("End date cannot be earlier than start date");
        } else {
          setDateError("");
        }
      }
      
      return newValues;
    });
  };

  return (
    <div className={styles.searchFilContainer}>
      {/* Input */}
      <input
        type="text"
        placeholder={placeholder}
        className={styles.input}
        value={searchValue}
        onChange={handleInputChange}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
      />

      {/* Search Button */}
      <button className={styles.iconButton} onClick={handleSearch}>
        <svg xmlns="http://www.w3.org/2000/svg" 
          width="24" height="24" viewBox="0 0 24 24" fill="none" 
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>

      {/* Filter Button */}
      <button className={styles.iconButton} onClick={() => {
        setShowFilterOverlay(true);
        setDateError(""); // Clear error when opening overlay
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" 
          width="24" height="24" viewBox="0 0 24 24" fill="none" 
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14"></line>
          <line x1="4" y1="10" x2="4" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12" y2="3"></line>
          <line x1="20" y1="21" x2="20" y2="16"></line>
          <line x1="20" y1="12" x2="20" y2="3"></line>
          <line x1="1" y1="14" x2="7" y2="14"></line>
          <line x1="9" y1="8" x2="15" y2="8"></line>
          <line x1="17" y1="16" x2="23" y2="16"></line>
        </svg>
      </button>

      {/* Filter Overlay */}
      {showFilterOverlay && (
        <div className={styles.filterOverlayBackdrop} onClick={() => {
          setShowFilterOverlay(false);
          setDateError(""); // Clear error when closing overlay
        }}>
          <div className={styles.filterOverlayContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.overlayCloseTopButton} onClick={() => {
              setShowFilterOverlay(false);
              setDateError(""); // Clear error when closing overlay
            }}>
              ✕
            </button>
            <h3>Apply Filters</h3>
            <div className={styles.overlayInputsGroup}>
              {filterFields.map((field, index) => (
                <div key={index} className={styles.overlayInputRow}>
                  <label htmlFor={field.name}>{field.label}:</label>
                  {field.type === "select" ? (
                    <div className={styles.selectWrapper}>
                      <select
                        id={field.name}
                        className={styles.overlayInput}
                        value={filterValues[field.name] || ""}
                        onChange={(e) => handleFilterValueChange(field.name, e.target.value)}
                      >
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <svg className={styles.selectIcon} xmlns="http://www.w3.org/2000/svg" 
                        width="16" height="16" viewBox="0 0 24 24" fill="none" 
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  ) : (
                    <>
                      <input
                        type={field.type || "text"}
                        id={field.name}
                        placeholder={field.placeholder || ""}
                        className={`${styles.overlayInput} ${field.name === "endDate" && dateError ? styles.errorInput : ""}`}
                        value={filterValues[field.name] || ""}
                        onChange={(e) => handleFilterValueChange(field.name, e.target.value)}
                        min={field.name === "endDate" && filterValues.startDate ? filterValues.startDate : (field.min || undefined)}
                        max={field.name === "startDate" && filterValues.endDate ? filterValues.endDate : (field.max || undefined)}
                      />
                      {field.name === "endDate" && dateError && (
                        <span className={styles.errorMessage}>{dateError}</span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.overlayButtons}>
              <button className={styles.overlayClearButton} onClick={handleClearFilters}>
                Clear All
              </button>
              <button className={styles.overlayApplyButton} onClick={handleApplyFilters}>
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
