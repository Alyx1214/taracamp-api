
import React from 'react';
import styles from './Notif.module.css';

export default function Notif({ notifications = [], onMarkAllAsRead }) {
	return (
		<div className={styles.notifContainer}>
			<div className={styles.headerRow}>
				<span className={styles.headerTitle}>Notifications</span>
				<button className={styles.markAllBtn} onClick={onMarkAllAsRead}>Mark all as Read</button>
			</div>
			<div className={styles.notifList}>
				{notifications.length === 0 ? (
					<div className={styles.emptyMsg}>No notifications</div>
				) : (
					notifications.map((notif, idx) => (
						<div
							key={notif.id || idx}
							className={
								notif.read
									? styles.notifItemRead
									: styles.notifItem
							}
						>
							<div className={styles.notifTitleRow}>
								<span className={styles.notifTitle}>{notif.title}</span>
								{notif.action && (
									<button className={styles.actionBtn} onClick={() => notif.onAction && notif.onAction(notif)}>&gt;</button>
								)}
							</div>
							{notif.body && (
								<div className={styles.notifBody}>{notif.body}</div>
							)}
							<div className={styles.notifMeta}>
								<span className={styles.notifSource}>{notif.source}</span>
								<span className={styles.notifTime}>{notif.time}</span>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
