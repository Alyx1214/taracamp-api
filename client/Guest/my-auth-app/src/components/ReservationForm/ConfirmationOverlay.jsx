import React from "react";
import styles from "./ConfirmationOverlay.module.css";

const ConfirmationOverlay = ({ onDone, onReview }) => (
	<div className={styles.overlay}>
		<div className={styles.container}>
			<div className={styles.header}></div>
			<div className={styles.checkmarkWrapper}>
				<div className={styles.checkmarkCircle}>
					<svg className={styles.checkmarkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="12" fill="none"/><path d="M7 13l3 3 7-7" stroke="#fff" strokeWidth="2.5" fill="none"/></svg>
				</div>
			</div>
			<div className={styles.title}>Thank you for submitting your reservation request</div>
			<div className={styles.desc}>
				We have received your details and are processing your booking. You will receive a confirmation email or notification once your reservation is officially confirmed.
			</div>
			<div className={styles.buttonRow}>
				<button className={`${styles.btnBase} ${styles.doneBtn}`} onClick={onDone}>Done</button>
				<button className={`${styles.btnBase} ${styles.reviewBtn}`} onClick={onReview}>Review Details</button>
			</div>
		</div>
	</div>
);

export default ConfirmationOverlay;
