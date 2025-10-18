import React from "react";
import styles from "./Pagination.module.css";

const Pagination = ({ 
  currentPage = 1, 
  totalPages = 1, 
  totalItems = 0, 
  onPageChange 
}) => {
  const itemsPerPage = 15;
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page) => {
    if (page !== currentPage) {
      onPageChange(page);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  if (totalItems === 0) {
    return null; // Don't show pagination if there's no data
  }

  // If there's only one page, show simplified pagination
  if (totalPages === 1) {
    return (
      <div className={styles["univ-pagination"]}>
        <span className={styles["pagination-info"]}>
          Showing {startItem} to {endItem} of {totalItems} items
        </span>
      </div>
    );
  }

  return (
    <div className={styles["univ-pagination"]}>
      <span className={styles["pagination-info"]}>
        Showing {startItem} to {endItem} of {totalItems} items
      </span>
      <div className={styles["pagination-controls"]}>
        <button 
          className={styles["pagination-arrow"]} 
          onClick={handlePrevious}
          disabled={currentPage === 1}
        >
          &lt;
        </button>
        {getPageNumbers().map(n => (
          <button
            key={n}
            className={`${styles["pagination-btn"]} ${n === currentPage ? styles["active"] : ""}`.trim()}
            onClick={() => handlePageClick(n)}
          >
            {n}
          </button>
        ))}
        <button 
          className={styles["pagination-arrow"]} 
          onClick={handleNext}
          disabled={currentPage === totalPages}
        >
          &gt;
        </button>
      </div>
    </div>
  );
};

export default Pagination;