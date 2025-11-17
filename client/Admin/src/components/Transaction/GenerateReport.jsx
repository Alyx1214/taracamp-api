import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaDownload, FaChevronDown, FaArrowLeft, FaFileAlt } from "react-icons/fa";
import styles from "./GenerateReport.module.css";
import { downloadAccommodationReportPDF, downloadSalesReportPDF } from "../../apis/reportApi";

export default function GenerateReport() {
  const navigate = useNavigate();
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
    if (!endMonth) {
      setError("Please select an end month.");
      return false;
    }
    if (startMonth && startMonth > endMonth) {
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
    } catch (e) {
      console.error(e);
      setError("Failed to generate PDF. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span
          className={styles["add-form-back"]}
          onClick={() => navigate(-1)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(-1)}
        >
          &larr;
        </span>
        <h1 className={styles.title}>Generate Report</h1>
      </div>

      <div className={styles.form}>
        {/* Report Type Selection */}
        <label className={styles.label}>Report Type</label>
        <div ref={reportTypeDropdownRef} className={styles.monthDropdown} role="presentation">
          <button
            type="button"
            className={`${styles.monthToggle} ${styles.reportTypeToggle}`}
            onClick={() => setReportTypeDropdownOpen((s) => !s)}
            aria-haspopup="listbox"
            aria-expanded={reportTypeDropdownOpen}
          >
            <span className={styles.iconWrap}><FaFileAlt className={styles.icon} /></span>
            <span className={styles.monthText}>{formatReportTypeLabel(reportType)}</span>
            <FaChevronDown className={styles.caret} />
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
                  {type.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Start Date */}
        <label className={styles.label} style={{ marginTop: 16 }}>Start Date</label>
        <div className={styles.monthRow}>
          <div ref={startDropdownRef} className={styles.monthDropdown} role="presentation">
            <button
              type="button"
              className={`${styles.monthToggle} ${styles.monthToggleStart}`}
              onClick={() => setStartDropdownOpen((s) => !s)}
              aria-haspopup="listbox"
              aria-expanded={startDropdownOpen}
            >
              <span className={styles.iconWrap}><FaCalendarAlt className={styles.icon} /></span>
              <span className={styles.monthText}>{formatMonthLabel(startMonth)}</span>
              <FaChevronDown className={styles.caret} />
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
                    {m.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* End Date */}
          <label className={styles.label} style={{ marginTop: 8 }}>End Date</label>
          <div ref={endDropdownRef} className={styles.monthDropdown} role="presentation" style={{ marginTop: 4 }}>
            <button
              type="button"
              className={styles.monthToggle}
              onClick={() => setEndDropdownOpen((s) => !s)}
              aria-haspopup="listbox"
              aria-expanded={endDropdownOpen}
            >
              <span className={styles.iconWrap}><FaCalendarAlt className={styles.icon} /></span>
              <span className={styles.monthText}>{formatMonthLabel(endMonth)}</span>
              <FaChevronDown className={styles.caret} />
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
                    {m.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button
          type="button"
          className={styles.downloadBtn}
          onClick={downloadPdf}
          disabled={generating || !reportType}
        >
          <FaDownload className={styles.downloadIcon} />
          {generating ? "Generating..." : "Download Report"}
        </button>
      </div>
    </div>
  );
}