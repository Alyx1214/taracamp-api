import React from 'react';
import styles from './NotifPreview.module.css';

// Props: notif (object), clientType (string), onConfirm, onCancel
// clientType: 'priva-group', 'individual', 'gov', 'deped'
export default function NotifPreview({
	notif = {},
	clientType = 'individual',
	onConfirm = () => {},
	onCancel = () => {},
}) {
	const isPay = clientType === 'priva-group' || clientType === 'individual';
	const confirmLabel = isPay ? 'Pay Now' : 'Confirm Now';

	return (
		<div className={styles.previewContainer}>
			<div className={styles.previewHeaderRow}>
				<button className={styles.previewBackBtn}>&#8592;</button>
				<span className={styles.previewHeaderTitle}>Notifications</span>
			</div>
			<div style={{ padding: '24px 32px 0 32px' }}>
				<div className={styles.previewTitleBox}>
					<span>{notif.title || 'Congratulations, Camper!  You have successfully booked a reservation!'}</span>
				</div>
				<div className={styles.previewBody}>
					{notif.body || (
						<>
							Thank you for choosing Teachers' Camp! Your reservation has been confirmed. We're excited to welcome you and ensure you have a comfortable and memorable stay.
						</>
					)}
				</div>
				<div className={styles.previewDetailsBox}>
					<div className={styles.previewDetailsTitle}>Reservation Details:</div>
					<div className={styles.previewDetailsRow}><b>Location:</b> Teachers' Camp, Baguio City</div>
					<div className={styles.previewDetailsRow}><b>Check-in Date:</b> {notif.checkInDate || '[Insert Date]'}</div>
					<div className={styles.previewDetailsRow}><b>Check-out Date:</b> {notif.checkOutDate || '[Insert Date]'}</div>
					<div className={styles.previewDetailsRow}><b>Accommodation Type:</b> {notif.accommodationType || '[Room/Cottage/Hall Name]'}</div>
					<div className={styles.previewDetailsRow}><b>Number of Guests:</b> {notif.numGuests || '[Insert Number]'}</div>
				</div>
				<div className={styles.previewNotice}>
					Please ensure the confirmation is made before the due date to avoid cancellation of your reservation.
				</div>
				<button
					className={styles.previewConfirmBtn}
					onClick={onConfirm}
				>
					{confirmLabel}
				</button>
				<div className={styles.previewCancelBox}>
					<div className={styles.previewCancelTitle}>Need to Cancel?</div>
					<div className={styles.previewCancelText}>
						We understand that plans may change.<br />
						If you wish to cancel your reservation, please click the cancel button below.
					</div>
					<button
						className={styles.previewCancelBtn}
						onClick={onCancel}
					>
						Cancel Booking
					</button>
				</div>
				<div className={styles.previewFooter}>
					Looking forward to seeing you soon!
				</div>
				<div className={styles.previewMeta}>
					<span className={styles.previewSource}>{notif.source || 'Teachers Camp'}</span>
					<span className={styles.previewTime}>{notif.time || '30mins'}</span>
				</div>
			</div>
		</div>
	);
}
