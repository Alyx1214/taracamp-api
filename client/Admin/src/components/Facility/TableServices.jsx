import React from "react";
import styles from "./TableServices.module.css";

export default function TableServices({ services }) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>EQUIPMENTS</th>
            <th className={styles.th}>PRICE</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.id}>
              <td className={styles.td}>{service.name}</td>
              <td className={styles.td}>
                ₱ {service.rate}
                {service.unit ? `/${service.unit}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}