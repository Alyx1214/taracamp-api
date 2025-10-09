import React, { useEffect, useState } from "react";
import styles from "./OtherService.module.css";
import { getAllAddons, searchAddons } from "../../apis/addonsApi"; // backend ready

export default function OtherService({ searchQuery = "" }) {
  const [services, setServices] = useState([]);
  const [state, setState] = useState({ loading: false, error: null });
  const [menuOpen, setMenuOpen] = useState(false);

  const staticData = [
    { name: "LCD Projector", price: "₱ 1,800.00/day" },
    { name: "LED Wall", price: "₱ 19,500.00/day" },
    { name: "Sound System", price: "₱ 1,200.00/day" },
    { name: "Videoke", price: "₱ 1,300.00/day" },
    { name: "Television (55”)", price: "₱ 1,800.00/day" },
    { name: "Television (32”)", price: "₱ 1,200.00/day" },
    { name: "Monobloc Chairs", price: "₱ 35.00/day" },
    { name: "Conference Table", price: "₱ 70.00/day" },
    { name: "Table Cloth", price: "₱ 30.00/pc" },
    { name: "Seat Cover", price: "₱ 20.00/pc" },
    { name: "Parachute", price: "₱ 1,200.00/day" },
    { name: "Parachute 1/Set up", price: "₱ 4,000.00/day" },
    { name: "Towel/Pillow/Blanket", price: "₱ 70.00/pc" },
    { name: "Electricity Fee", price: "₱ 360.00/day/1000watts" },
    { name: "Corkage Fee", price: "₱ 2,500.00 - 8,500.00/day" },
    { name: "FAX Machine", price: "₱ 40.00/pc" },
    { name: "Telephone", price: "₱ 5.00/call/5mins." },
    { name: "Certification Fee", price: "₱ 200.00/certificate" },
  ];

  useEffect(() => {
    setServices(staticData);
  }, [searchQuery]);

  const isLoading = state.loading;
  const hasError = !isLoading && Boolean(state.error);

  const handleEditClick = () => {
    // Navigate to edit page or open modal here
    alert("Redirecting to Edit Page...");
    setMenuOpen(false);
  };

  return (
    <div className={styles.otherServiceContainer}>
      <div className={styles.otherServiceBox}>
        {/* ⋮ Menu Button */}
        <div className={styles.menuWrapper}>
          <button
            className={styles.menuButton}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ⋮
          </button>
          {menuOpen && (
            <div className={styles.menuDropdown}>
              <button onClick={handleEditClick}>Edit</button>
            </div>
          )}
        </div>

        <div className={styles.otherServiceHeader}>
          <span>EQUIPMENT</span>
          <span>PRICE</span>
        </div>

        {isLoading && <p>Loading...</p>}
        {hasError && <p className={styles.errorText}>{state.error}</p>}

        <ul className={styles.otherServiceList}>
          {services.map((item, index) => (
            <li key={index} className={styles.otherServiceItem}>
              <span>{item.name}</span>
              <span>{item.price}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
