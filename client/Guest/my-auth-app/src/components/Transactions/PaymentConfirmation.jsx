import React from "react";
import styles from "./PaymentConfirmation.module.css";

const PaymentConfirmation = ({ onDone, onViewTransaction, paymentDetails }) => (
  <div className={styles.overlay}>
    <div className={styles.container}>
      <div className={styles.header}></div>
      <div className={styles.checkmarkWrapper}>
        <div className={styles.checkmarkCircle}>
          <svg 
            className={styles.checkmarkIcon} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="12" fill="none"/>
            <path d="M7 13l3 3 7-7" stroke="#fff" strokeWidth="2.5" fill="none"/>
          </svg>
        </div>
      </div>
      <div className={styles.title}>Payment Submitted Successfully!</div>
      <div className={styles.desc}>
        Thank you for submitting your payment. We have received your payment proof and reference number. 
        Your payment will be verified shortly, and you will receive a confirmation once the verification is complete.
      </div>
      
      {paymentDetails && (
        <div className={styles.paymentSummary}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Payment Method:</span>
            <span className={styles.summaryValue}>{paymentDetails.channel}</span>
          </div>
          {paymentDetails.referenceNumber && (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Reference Number:</span>
              <span className={styles.summaryValue}>{paymentDetails.referenceNumber}</span>
            </div>
          )}
          {paymentDetails.amount && (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Amount:</span>
              <span className={styles.summaryValue}>₱ {paymentDetails.amount.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
      
      <div className={styles.buttonRow}>
        <button 
          className={`${styles.btnBase} ${styles.doneBtn}`} 
          onClick={onDone}
        >
          Done
        </button>
        <button 
          className={`${styles.btnBase} ${styles.reviewBtn}`} 
          onClick={onViewTransaction}
        >
          View Transaction
        </button>
      </div>
    </div>
  </div>
);

export default PaymentConfirmation;