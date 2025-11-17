import React, { useRef, useState, useEffect } from "react";
import { FaCalendarAlt, FaDownload, FaChevronDown, FaTimes, FaFileAlt } from "react-icons/fa";
import styles from "./GenerateReport.module.css";
import { downloadAccommodationReportPDF, downloadSalesReportPDF } from "../../apis/reportApi";

export default function GenerateReport({ isOpen, onClose }) {
  const [reportType, setReportType] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);

  const [reportTypeDropdownOpen, setReportTypeDropdownOpen] = useState(false);
  const [startDropdownOpen, setStartDropdownOpen] = useState(false);
  const [endDropdownOpen, setEndDropdownOpen] = useState(false);

  const reportTypeDropdownRef = useRef(null);
  const startDropdownRef = useRef(null);
  const endDropdownRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (reportTypeDropdownRef.current && !reportTypeDropdownRef.current.contains(e.target)) {
        setReportTypeDropdownOpen(false);
      }
      if (startDropdownRef.current && !startDropdownRef.current.contains(e.target)) {
        setStartDropdownOpen(false);
      }
      if (endDropdownRef.current && !endDropdownRef.current.contains(e.target)) {
        setEndDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setReportType("");
      setStartMonth("");
      setEndMonth("");
      setError(null);
      setGenerating(false);
      setReportTypeDropdownOpen(false);
      setStartDropdownOpen(false);
      setEndDropdownOpen(false);
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const reportTypes = [
    { value: "accommodation", label: "Accommodation Report" },
    { value: "revenue", label: "Revenue Report" }
  ];

  const months = Array.from({ length: 60 }).map((_, i) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear().toString().padStart(4, "0")}-${(
      d.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}`;
    return { value: val, label: d.toLocaleString(undefined, { month: "long", year: "numeric" }) };
  });

  const formatMonthLabel = (val) => {
    if (!val) return "Select month";
    const [y, m] = val.split("-");
    const d = new Date(Number(y), Number(m) - 1);
    return d.toLocaleString(undefined, { month: "long", year: "numeric" });
  };

  const formatReportTypeLabel = (val) => {
    if (!val) return "Select report type";
    const type = reportTypes.find(t => t.value === val);
    return type ? type.label : "Select report type";
  };

  const validateRange = () => {
    if (!reportType) {
      setError("Please select a report type.");
      return false;
    }
    if (!startMonth) {
      setError("Please select a start month.");
      return false;
    }
    if (!endMonth) {
      setError("Please select an end month.");
      return false;
    }
    if (startMonth > endMonth) {
      setError("Start month must be before or equal to end month.");
      return false;
    }
    setError(null);
    return true;
  };

  const downloadPdf = async () => {
    if (!validateRange()) return;
    setGenerating(true);
    try {
      const [yearStr, monthStr] = endMonth.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);

      if (reportType === "accommodation") {
        await downloadAccommodationReportPDF({ year, month });
      } else if (reportType === "revenue") {
        await downloadSalesReportPDF({ year, month });
      }
      
      // Close modal after successful generation
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (e) {
      console.error(e);
      setError("Failed to generate PDF. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        ref={modalRef}
        className={styles.modalContent} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderContent}>
            <div className={styles.modalIcon}>
              <FaFileAlt />
            </div>
            <h2 className={styles.modalTitle}>Generate Report</h2>
          </div>
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            aria-label="Close modal"
          >
            <FaTimes />
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.modalDescription}>
            Select the report type and date range to generate your custom report.
          </p>

          <div className={styles.form}>
            {/* Report Type Selection */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                <span className={styles.labelIcon}>📊</span>
                Report Type<span className={styles.required}>*</span>
              </label>
              <div ref={reportTypeDropdownRef} className={styles.monthDropdown} role="presentation">
                <button
                  type="button"
                  className={`${styles.monthToggle} ${reportType ? styles.hasValue : ''}`}
                  onClick={() => setReportTypeDropdownOpen((s) => !s)}
                  aria-haspopup="listbox"
                  aria-expanded={reportTypeDropdownOpen}
                >
                  <span className={styles.iconWrap}><FaFileAlt className={styles.icon} /></span>
                  <span className={styles.monthText}>{formatReportTypeLabel(reportType)}</span>
                  <FaChevronDown className={`${styles.caret} ${reportTypeDropdownOpen ? styles.caretOpen : ''}`} />
                </button>

                {reportTypeDropdownOpen && (
                  <ul className={styles.monthList} role="listbox" tabIndex={-1}>
                    {reportTypes.map((type) => (
                      <li
                        key={type.value}
                        role="option"
                        aria-selected={type.value === reportType}
                        className={`${styles.monthListItem} ${type.value === reportType ? styles.selectedItem : ""}`}
                        onClick={() => { setReportType(type.value); setReportTypeDropdownOpen(false); }}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (setReportType(type.value), setReportTypeDropdownOpen(false))}
                        tabIndex={0}
                      >
                        <span className={styles.itemIcon}>📄</span>
                        {type.label}
                        {type.value === reportType && <span className={styles.checkmark}>✓</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Start Date */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                <span className={styles.labelIcon}>📅</span>
                Start Date<span className={styles.required}>*</span>
              </label>
              <div ref={startDropdownRef} className={styles.monthDropdown} role="presentation">
                <button
                  type="button"
                  className={`${styles.monthToggle} ${startMonth ? styles.hasValue : ''}`}
                  onClick={() => setStartDropdownOpen((s) => !s)}
                  aria-haspopup="listbox"
                  aria-expanded={startDropdownOpen}
                >
                  <span className={styles.iconWrap}><FaCalendarAlt className={styles.icon} /></span>
                  <span className={styles.monthText}>{formatMonthLabel(startMonth)}</span>
                  <FaChevronDown className={`${styles.caret} ${startDropdownOpen ? styles.caretOpen : ''}`} />
                </button>

                {startDropdownOpen && (
                  <ul className={styles.monthList} role="listbox" tabIndex={-1}>
                    {months.map((m) => (
                      <li
                        key={m.value}
                        role="option"
                        aria-selected={m.value === startMonth}
                        className={`${styles.monthListItem} ${m.value === startMonth ? styles.selectedItem : ""}`}
                        onClick={() => { setStartMonth(m.value); setStartDropdownOpen(false); }}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (setStartMonth(m.value), setStartDropdownOpen(false))}
                        tabIndex={0}
                      >
                        <span className={styles.itemIcon}>📅</span>
                        {m.label}
                        {m.value === startMonth && <span className={styles.checkmark}>✓</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* End Date */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                <span className={styles.labelIcon}>📅</span>
                End Date<span className={styles.required}>*</span>
              </label>
              <div ref={endDropdownRef} className={styles.monthDropdown} role="presentation">
                <button
                  type="button"
                  className={`${styles.monthToggle} ${endMonth ? styles.hasValue : ''}`}
                  onClick={() => setEndDropdownOpen((s) => !s)}
                  aria-haspopup="listbox"
                  aria-expanded={endDropdownOpen}
                >
                  <span className={styles.iconWrap}><FaCalendarAlt className={styles.icon} /></span>
                  <span className={styles.monthText}>{formatMonthLabel(endMonth)}</span>
                  <FaChevronDown className={`${styles.caret} ${endDropdownOpen ? styles.caretOpen : ''}`} />
                </button>

                {endDropdownOpen && (
                  <ul className={styles.monthList} role="listbox" tabIndex={-1}>
                    {months.map((m) => (
                      <li
                        key={m.value}
                        role="option"
                        aria-selected={m.value === endMonth}
                        className={`${styles.monthListItem} ${m.value === endMonth ? styles.selectedItem : ""}`}
                        onClick={() => { setEndMonth(m.value); setEndDropdownOpen(false); }}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (setEndMonth(m.value), setEndDropdownOpen(false))}
                        tabIndex={0}
                      >
                        <span className={styles.itemIcon}>📅</span>
                        {m.label}
                        {m.value === endMonth && <span className={styles.checkmark}>✓</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {error && (
              <div className={styles.errorContainer}>
                <span className={styles.errorIcon}>⚠️</span>
                <span className={styles.error}>{error}</span>
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={generating}
              >
                <FaTimes className={styles.cancelIcon} />
                Cancel
              </button>
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={downloadPdf}
                disabled={generating || !reportType || !startMonth || !endMonth}
              >
                <FaDownload className={styles.downloadIcon} />
                {generating ? "Generating..." : "Download Report"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}