import React from 'react';
import styles from './NotifUpload.module.css';

export default function NotifUpload({ onBack = () => {} }) {
  return (
    <div className={styles.uploadContainer}>
      <div className={styles.headerRow}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back">&#8592;</button>
        <span className={styles.headerTitle}>Notifications</span>
      </div>
      <div className={styles.contentBox}>
        <div className={styles.titleBox}>
          <span>Documents Successfully Uploaded! Your reservation is all set.</span>
        </div>
        <div className={styles.bodyText}>
          Thank you for submitting your documents! We have received all the required files for your reservation at Teachers' Camp.
        </div>
        <div className={styles.importantNotice}>
          <div className={styles.noticeIcon}>⚠️</div>
          <div className={styles.noticeContent}>
            <strong>Important Reminder:</strong>
            <p>Please bring the hard copies of all uploaded documents upon check-in. These physical copies are required for verification purposes.</p>
          </div>
        </div>
        <div className={styles.checklistBox}>
          <h3 className={styles.checklistTitle}>Documents to Bring:</h3>
          <ul className={styles.checklistItems}>
            <li>✓ Original or certified true copies of uploaded documents</li>
            <li>✓ Valid government-issued ID</li>
            <li>✓ Reservation confirmation (printed or digital)</li>
          </ul>
        </div>
        <div className={styles.footerText}>
          We're excited to welcome you to Teachers' Camp! If you have any questions, feel free to contact us.
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaSource}>Teachers' Camp</span>
          <span className={styles.metaTime}>Just now</span>
        </div>
      </div>
    </div>
  );
}