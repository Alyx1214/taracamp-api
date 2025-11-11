import React from "react";
import styles from "./ConfirmModal.module.css";

export default function ConfirmModal({
  open,
  title = "Confirm",
  message = "Are you sure?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirming = false,
  onConfirm,
  onCancel,
  variant = "danger", // Add this prop: 'danger', 'success', 'delete', 'warning', 'primary'
}) {
  if (!open) return null;

  // Map variant to dialog and button classes
  const dialogVariantClass = {
    danger: styles.dialogDanger,
    success: styles.dialogSuccess,
    delete: styles.dialogDelete,
    warning: styles.dialogWarning,
    primary: styles.dialogDanger,
  }[variant] || styles.dialogDanger;

  const confirmButtonClass = {
    danger: styles.btnDanger,
    success: styles.btnSuccess,
    delete: styles.btnDelete,
    warning: styles.btnWarning,
    primary: styles.btnPrimary,
  }[variant] || styles.btnDanger;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={`${styles.dialog} ${dialogVariantClass}`}>
        {title ? <div className={styles.header}>{title}</div> : null}
        <div className={styles.content}>{message}</div>
        <div className={styles.actions}>
          <button 
            className={`${styles.btn} ${styles.btnCancel}`} 
            onClick={onCancel} 
            disabled={confirming}
          >
            {cancelText}
          </button>
          <button 
            className={`${styles.btn} ${confirmButtonClass}`} 
            onClick={onConfirm} 
            disabled={confirming}
          >
            {confirming ? "Please wait..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}