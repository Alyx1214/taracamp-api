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
}) {
  if (!open) return null;
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.dialog}>
        {title ? <div className={styles.header}>{title}</div> : null}
        <div className={styles.content}>{message}</div>
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel} disabled={confirming}>
            {cancelText}
          </button>
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onConfirm} disabled={confirming}>
            {confirming ? "Please wait..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

