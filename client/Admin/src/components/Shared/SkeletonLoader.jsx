import React from "react";
import styles from "./SkeletonLoader.module.css";

export default function SkeletonLoader({ rows = 5, columns = 5, columnsData = [] }) {
  return (
    <div className={styles["skeleton-container"]}>
      <table className={styles["skeleton-table"]}>
        <thead>
          <tr>
            {columnsData.length > 0 ? (
              columnsData.map((col, index) => (
                <th key={index}>{col}</th>
              ))
            ) : (
              Array.from({ length: columns }).map((_, index) => (
                <th key={index}>
                  <div className={styles["skeleton-header"]}></div>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex}>
                  <div className={styles["skeleton-cell"]}>
                    <div className={styles["skeleton-content"]}></div>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
