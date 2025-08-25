import React from "react";
import styles from "./ConfirmDeleteModal.module.css";

export default function ConfirmDeleteModal({ isOpen, onClose, onConfirm, type }) {
if (!isOpen) return null;

return (
<div className={styles.overlay}>
<div className={styles.modal}>
<div className={styles.modalHeader}></div>

<div className={styles.modalContent}>
<div className={styles.icon}>!</div>

<p className={styles.text}>
Deleting this {type?.toLowerCase()} is a{" "}
<strong>permanent action</strong> and <strong>cannot be undone</strong>.
Please ensure you have reviewed all related information before proceeding.
</p>

<p className={styles.confirmText}>Are you sure you want to continue?</p>

<div className={styles.actions}>
<button onClick={onClose} className={styles.cancelButton}>
Cancel
</button>
<button onClick={onConfirm} className={styles.confirmButton}>
Confirm
</button>
</div>
</div>
</div>
</div>
);
}