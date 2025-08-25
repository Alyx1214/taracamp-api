import React from 'react';
import styles from './NotifIndiv.module.css';

export default function NotifIndiv({
  notif = {},
  onFoodPref = () => {},
  onCancel = () => {},
  onBack = () => {},
}) {
  return (
    <div className={styles.indivContainer}>
      <div className={styles.headerRow}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back to notifications">
          &#8592;
        </button>
        <span className={styles.headerTitle}>Notifications</span>
      </div>
      <div className={styles.contentBox}>
        <div className={styles.titleBox}>
          <span>
            {notif.title ||
              "Congratulations, Camper! Payment Successful — your reservation is now confirmed. We can't wait to welcome you!"}
          </span>
        </div>
        <div className={styles.bodyText}>
          {notif.body || (
            <>
              Thank you for choosing Teachers' Camp! Your reservation has been confirmed. We're excited to welcome you and ensure you have a comfortable and memorable stay.
            </>
          )}
        </div>
        <div className={styles.foodPrefBox}>
          Thank you for reserving your stay with us! Please choose your preferred meals for your stay by clicking the food preference button below.
        </div>
        <button className={styles.foodPrefBtn} onClick={onFoodPref}>Food Preference</button>
        <div className={styles.cancelBox}>
          <div className={styles.cancelTitle}>Need to Cancel?</div>
          <div className={styles.cancelText}>
            We understand that plans may change.<br />
            If you wish to cancel your reservation, please click the cancel button below.
          </div>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel Booking</button>
        </div>
        <div className={styles.footerText}>Looking forward to seeing you soon!</div>
        <div className={styles.metaRow}>
          <span className={styles.metaSource}>{notif.source || 'Teachers Camp'}</span>
          <span className={styles.metaTime}>{notif.time || new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
