import React from "react";
import styles from "./UsersModal.module.css";
import { FaCheckCircle, FaTimes } from "react-icons/fa";

export default function SuccessModal({ open, message, onClose, autoClose = true, duration = 3000 }) {
  React.useEffect(() => {
    if (open && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [open, autoClose, duration, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>
        <div className={styles.iconContainer}>
          <FaCheckCircle className={styles.successIcon} />
        </div>
        <h2 className={styles.title}>Success!</h2>
        <p className={styles.message}>{message}</p>
        <button className={styles.okBtn} onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}