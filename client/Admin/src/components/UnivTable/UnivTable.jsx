import React, { useState, useRef, useEffect } from "react";
import { FaEllipsisV } from "react-icons/fa";
import styles from "./UnivTable.module.css";
import SkeletonLoader from "../Shared/SkeletonLoader";

export default function UnivTable({ columns, data, renderActions, renderMenu, loading = false }) {
  const [openMenuIndex, setOpenMenuIndex] = useState(null);
  const menuRefs = useRef({});

  const toggleMenu = (index) => {
    setOpenMenuIndex(openMenuIndex === index ? null : index);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        openMenuIndex !== null &&
        menuRefs.current[openMenuIndex] &&
        !menuRefs.current[openMenuIndex].contains(event.target)
      ) {
        setOpenMenuIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuIndex]);

  const getColumnKey = (columnName) => {
    const mapping = {
      ID: "id",
      Name: "name",
      Email: "email",
      "Service Type": "serviceType",
      "Facility Type": "facilityType",
      "Facility Name": "facilityName",
      "Arrival Date": "arrivalDate",
      "Departure Date": "departureDate",
      Date: "date",
    };
    // If not in mapping, convert to camelCase: "Facility Type" -> "facilityType"
    if (mapping[columnName]) {
      return mapping[columnName];
    }
    // Convert "Some Column Name" to "someColumnName"
    const words = columnName.toLowerCase().split(/\s+/);
    return words[0] + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  };

  if (loading) {
    return <SkeletonLoader rows={5} columns={columns.length} columnsData={columns} />;
  }

  return (
    <div className={styles["univtable-container"]}>
      <table className={styles.univtable}>
        <thead>
          <tr>
            {columns.map((col, index) => (
              <th key={index}>{col}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.length ? (
            data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col, colIndex) =>
                  col === "Actions" ? (
                    <td
                      key={colIndex}
                      className={styles["univ-actions-cell"]}
                      ref={(el) => (menuRefs.current[rowIndex] = el)}
                    >
                      <div className={styles["univ-actions-wrapper"]}>
                        {renderActions ? (
                          renderActions(row)
                        ) : (
                          <>
                            <button className={styles["univ-approve-btn"]}>
                              Approve
                            </button>
                            <button className={styles["univ-decline-btn"]}>
                              Decline
                            </button>
                            <button className={styles["univ-view-btn"]}>
                              View
                            </button>
                            <button className={styles["univ-delete-btn"]}>
                              Delete
                            </button>
                            <button className={styles["univ-edit-btn"]}>
                              Edit
                            </button>
                          </>
                        )}

                        {renderMenu && (
                          <button
                            className={styles["univ-three-dots-btn"]}
                            onClick={() => toggleMenu(rowIndex)}
                            aria-label="More actions"
                          >
                            <FaEllipsisV />
                          </button>
                        )}

                        {openMenuIndex === rowIndex && renderMenu && (
                          <div className={styles["univ-dropdown-menu"]}>
                            {renderMenu(row).map((item, idx) => (
                              <button
                                key={idx}
                                className={styles["univ-dropdown-item"]}
                                onClick={() => {
                                  item.onClick();
                                  setOpenMenuIndex(null);
                                }}
                                type="button"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  ) : (
                    <td key={colIndex}>{row[getColumnKey(col)] || "-"}</td>
                  )
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className={styles["univ-no-data"]}>
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
