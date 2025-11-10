import React, { useState } from "react";
import styles from "./SearchFil.module.css";

export default function SearchFil({ 
  placeholder = "Search", 
  onSearch, 
  onApplyFilters,
  filterFields = []
}) {
  const [searchValue, setSearchValue] = useState("");
  const [showFilterOverlay, setShowFilterOverlay] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const handleSearch = () => {
    if (onSearch) onSearch(searchValue);
  };

  const handleInputChange = (e) => {
    setSearchValue(e.target.value);
    if (e.target.value === "" && onSearch) {
      onSearch(""); // Clear search
    }
  };

  const handleApplyFilters = () => {
    if (onApplyFilters) {
      onApplyFilters(filterValues);
    }
    setShowFilterOverlay(false);
  };

  const handleClearFilters = () => {
    setFilterValues({});
    if (onApplyFilters) onApplyFilters({});
  };

  const handleFilterValueChange = (fieldName, value) => {
    setFilterValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
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
      <button className={styles.iconButton} onClick={() => setShowFilterOverlay(true)}>
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
        <div className={styles.filterOverlayBackdrop} onClick={() => setShowFilterOverlay(false)}>
          <div className={styles.filterOverlayContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.overlayCloseTopButton} onClick={() => setShowFilterOverlay(false)}>
              ✕
            </button>
            <h3>Apply Filters</h3>
            <div className={styles.overlayInputsGroup}>
              {filterFields.map((field, index) => (
                <div key={index} className={styles.overlayInputRow}>
                  <label htmlFor={field.name}>{field.label}:</label>
                  {field.type === "select" ? (
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
                  ) : (
                    <input
                      type={field.type || "text"}
                      id={field.name}
                      placeholder={field.placeholder || ""}
                      className={styles.overlayInput}
                      value={filterValues[field.name] || ""}
                      onChange={(e) => handleFilterValueChange(field.name, e.target.value)}
                      min={field.min || undefined}
                      max={field.max || undefined}
                    />
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
