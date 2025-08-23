import React from 'react';
import styles from './RevDetails.module.css';

function RevDetails({ onClose, data, amount, onCancel }) {
	
	return (
		<div className={styles.overlay}>
			<div className={styles.detailsCard}>
				<div className={styles.headerBar}>
					<span className={styles.title}>RESERVATION DETAILS</span>
					<button className={styles.closeBtn} onClick={onClose}>×</button>
				</div>
				<div className={styles.detailsContent}>
					<table className={styles.detailsTable}>
						<tbody>
							<tr><td>Group/Association</td><td>:</td><td>{data.group}</td></tr>
							<tr><td>Address</td><td>:</td><td>{data.address}</td></tr>
							<tr><td>Office Address</td><td>:</td><td>{data.officeAddress}</td></tr>
							<tr><td>Category</td><td>:</td><td>{data.category}</td></tr>
							<tr><td>Phone No.</td><td>:</td><td>{data.phone}</td></tr>
							<tr><td>Office Telephone No.</td><td>:</td><td>{data.officeTel}</td></tr>
							<tr><td>Number of Guests</td><td>:</td><td>{data.guests}</td></tr>
							<tr><td>Emergency Contact</td><td>:</td><td>{data.emergency}</td></tr>
							<tr><td>Date of Arrival</td><td>:</td><td>{data.arrival}</td></tr>
							<tr><td>Date of Departure</td><td>:</td><td>{data.departure}</td></tr>
							<tr><td>Type of Facility</td><td>:</td><td>{data.facilityType}</td></tr>
							<tr><td>Facility Name</td><td>:</td><td>{data.facilityName}</td></tr>
							<tr><td>Type of Service</td><td>:</td><td>{data.service}</td></tr>
							<tr className={styles.amountRow}>
								<td colSpan={3}>
									<div className={styles.amountLine}></div>
									<div className={styles.amountLabel}>Total Estimated Amount</div>
									<span className={styles.amountValue}>{amount}</span>
								</td>
							</tr>
						</tbody>
					</table>
					<div className={styles.amountNote}>
						Note that this is just an estimated amount and is subject to change
					</div>
					<div className={styles.successMsg}>
						Your reservation has been successfully submitted! We will process your request and send a confirmation soon.
					</div>
					<div className={styles.stayMsg}>
						Looking forward to your stay at Teachers’ Camp!
					</div>
					<div className={styles.cancelSection}>
						<div className={styles.cancelTitle}>Cancel your booking?</div>
						<div className={styles.cancelNote}>
							We understand that plans may change.<br />
							If you wish to cancel your reservation, please click the cancel button.
						</div>
						<button className={styles.cancelBtn} onClick={onCancel}>Cancel Booking</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default RevDetails;
