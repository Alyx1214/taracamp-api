import React, { useState, useEffect, useRef } from "react";
import { FaEdit } from "react-icons/fa";
import styles from "./OtherService.module.css";

export default function OtherService({ onEdit, editable, onSave, onCancel }) {
  const [services, setServices] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const initial = [
      { name: "LCD Projector", price: "₱1,800.00", unit: "day" },
      { name: "LED Wall", price: "₱19,500.00", unit: "day" },
      { name: "Sound System", price: "₱1,200.00", unit: "day" },
      { name: "Videoke", price: "₱1,300.00", unit: "day" },
      { name: 'Television (55")', price: "₱1,800.00", unit: "day" },
      { name: 'Television (32")', price: "₱1,200.00", unit: "day" },
      { name: "Monobloc Chairs", price: "₱35.00", unit: "day" },
      { name: "Conference Table", price: "₱70.00", unit: "day" },
      { name: "Table Cloth", price: "₱30.00", unit: "pc" },
      { name: "Seat Cover", price: "₱20.00", unit: "pc" },
      { name: "Parachute", price: "₱1,200.00", unit: "day" },
      { name: "Parachute 1/Set up", price: "₱4,000.00", unit: "day" },
      { name: "Towel/Pillow/Blanket", price: "₱70.00", unit: "pc" },
      { name: "Electricity Fee", price: "₱360.00", unit: "day" },
      { name: "Corkage Fee", price: "₱2,500.00", unit: "day" },
      { name: "FAX Machine", price: "₱40.00", unit: "pc" },
      { name: "Telephone", price: "₱5.00", unit: "5mins." },
      { name: "Certification Fee", price: "₱200.00", unit: "certificate" },
    ];
    setServices(initial);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (index, field, value) => {
    const updated = [...services];
    updated[index][field] = value;
    setServices(updated);
  };

  const handleSave = () => {
    if (onSave) onSave(services);
  };

  //Editable
  if (editable) {
    return (
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <span className={styles.backArrow} onClick={onCancel}>←</span>
          <h2>OTHER SERVICE</h2>
        </div>

        <div className={styles.tableContainer}>
          <div className={styles.tableHeader}>
            <span>EQUIPMENTS</span>
            <span>PRICE</span>
          </div>

          <ul className={styles.tableList}>
            {services.map((item, index) => (
              <li key={index} className={styles.tableItem}>
                <input
                  type="text"
                  className={styles.nameInput}
                  value={item.name}
                  onChange={(e) =>
                    handleInputChange(index, "name", e.target.value)
                  }
                />
                <div className={styles.priceWrapper}>
                  <input
                    type="text"
                    className={styles.pricePill}
                    value={item.price}
                    onChange={(e) =>
                      handleInputChange(index, "price", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    className={styles.unitPill}
                    value={item.unit}
                    onChange={(e) =>
                      handleInputChange(index, "unit", e.target.value)
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <button className={styles.saveBtn} onClick={handleSave}>
          SAVE CHANGES
        </button>
      </div>
    );
  }

  //Default
  return (
    <div className={styles.container}>
      <div className={styles.tableContainer}>
        <div className={styles.menuWrapper} ref={menuRef}>
          <div
            className={styles.cardMenu}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ⋮
          </div>
          {menuOpen && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownItem} onClick={onEdit}>
                <FaEdit className={styles.icon} /> Edit
              </div>
            </div>
          )}
        </div>

        <div className={styles.tableHeader}>
          <span>EQUIPMENTS</span>
          <span>PRICE</span>
        </div>

        <ul className={styles.tableList}>
          {services.map((item, index) => (
            <li key={index} className={styles.tableItem}>
              <span>{item.name}</span>
              <span>
                {item.price}
                <span className={styles.unit}>/{item.unit}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
