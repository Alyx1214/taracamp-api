import React, { useState } from "react";
import styles from "./NotifReviews.module.css";

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

export default function NotifReviews({ initial = {}, onSubmit }) {
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
        <aside className={styles.toast} role="status" aria-live="polite">
            <div className={styles.header}>
                <div className={styles.title}>Share your stay</div>
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
        </aside>
    );
}