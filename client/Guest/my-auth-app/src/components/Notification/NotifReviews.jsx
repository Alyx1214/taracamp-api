import React, { useState } from "react";
import styles from "./NotifReviews.module.css";
import { timeAgo } from "../../utils/timeAgo";

function StarRating({ value, onChange, label }) {
    return (
        <div className={styles.starRow} aria-label={label}>
            <span className={styles.starLabel}>{label}</span>
            <div className={styles.stars} role="radiogroup">
                {[1, 2, 3, 4, 5].map((i) => (
                    <button
                        key={i}
                        type="button"
                        className={i <= value ? styles.starActive : styles.star}
                        onClick={() => onChange(i)}
                        aria-checked={i === value}
                        role="radio"
                        title={`${i} ${label}`}
                    >
                        ★
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function NotifReviews({ initial = {}, onSubmit = () => {}, onBack = () => {} }) {
    const [location, setLocation] = useState(initial.location || 0);
    const [service, setService] = useState(initial.service || 0);
    const [cleanliness, setCleanliness] = useState(initial.cleanliness || 0);
    const [overall, setOverall] = useState(initial.overall || 0);
    const [comment, setComment] = useState(initial.comment || "");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e && e.preventDefault();
        setSubmitting(true);
        const payload = { location, service, cleanliness, overall, comment };
        try {
            if (onSubmit) await onSubmit(payload);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.revContainer} role="status" aria-live="polite">
            <div className={styles.headerRow}>
                <button className={styles.backBtn} onClick={onBack} aria-label="Back to notifications">
                    &#8592;
                </button>
                <span className={styles.headerTitle}>Notifications</span>
            </div>

            <div className={styles.contentBox}>
                <div className={styles.titleBox}>
                    <span>{initial.title || "Thank you for staying with us Camper. Please, tell us about your stay!"}</span>
                </div>
                <div className={styles.bodyText}>
                    {initial.body || (
                    <>
                        We hope you enjoyed your recent time with us. Your feedback helps us improve! Please take a moment to leave a review and let us know about your experience.
                    </>
                    )}
                </div>

                <form className={styles.body} onSubmit={handleSubmit}>
                    <StarRating label="Location" value={location} onChange={setLocation} />
                    <StarRating label="Service" value={service} onChange={setService} />
                    <StarRating label="Cleanliness" value={cleanliness} onChange={setCleanliness} />
                    <StarRating label="Overall" value={overall} onChange={setOverall} />

                    <label className={styles.commentLabel}>
                        <span className={styles.commentTitle}>Comment</span>
                        <textarea
                            className={styles.textarea}
                            placeholder="Tell others about your experience..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                            disabled={submitting}
                        />
                    </label>

                    <div className={styles.actions}>
                        <button type="submit" className={styles.primary} disabled={submitting}>
                            {submitting ? "Sending…" : "Submit Review"}
                        </button>
                    </div>
                </form>

                <div className={styles.footerText}>Thank you for taking the time to review your stay.</div>

                <div className={styles.metaRow}>
                    <span className={styles.metaSource}>{initial.source || "Teachers Camp"}</span>
                    <span className={styles.metaTime}>{timeAgo(initial.time) || "Just now"}</span>
                </div>
            </div>
        </div>
    );
}