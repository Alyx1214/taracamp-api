import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaStar, FaReply, FaTrash, FaEyeSlash, FaEye } from "react-icons/fa";
import styles from "./Reviews.module.css";
import { 
  getReviewsByFacilityId, 
  deleteReview, 
  addAdminReply, 
  toggleReviewVisibility 
} from "../../apis/api";

export default function Reviews() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { category, facility } = location.state || {};

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    fetchReviews();
  }, [id]);

  const fetchReviews = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await getReviewsByFacilityId(id);
      
      if (response.reviews) {
        // Map backend data to frontend format
        const mappedReviews = response.reviews.map((review) => ({
          id: review.id,
          userName: review.authorName || "Anonymous",
          // Convert overall rating (1-10) to 1-5 scale for display
          rating: Math.max(1, Math.ceil((review.rating?.overall || 1) / 2)),
          comment: review.text,
          date: review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "Unknown",
          hidden: review.hidden || false,
          adminReply: review.adminReply || null,
        }));
        setReviews(mappedReviews);
      } else {
        setReviews([]);
      }
    } catch (err) {
      console.error("Error fetching reviews:", err);
      setError(err.message || "Failed to fetch reviews");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReplySubmit = async (reviewId) => {
    if (!replyText.trim()) return;

    try {
      await addAdminReply(reviewId, replyText.trim());
      // Update local state
      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId
            ? { ...review, adminReply: replyText.trim() }
            : review
        )
      );
      setReplyingTo(null);
      setReplyText("");
    } catch (err) {
      console.error("Error adding admin reply:", err);
      alert(err.message || "Failed to add reply");
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm("Are you sure you want to delete this review?")) {
      return;
    }

    try {
      await deleteReview(reviewId);
      // Remove from local state
      setReviews((prev) => prev.filter((review) => review.id !== reviewId));
    } catch (err) {
      console.error("Error deleting review:", err);
      alert(err.message || "Failed to delete review");
    }
  };

  const handleToggleHidden = async (reviewId) => {
    const review = reviews.find((r) => r.id === reviewId);
    if (!review) return;

    const newHiddenState = !review.hidden;

    try {
      await toggleReviewVisibility(reviewId, newHiddenState);
      // Update local state
      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId
            ? { ...review, hidden: newHiddenState }
            : review
        )
      );
    } catch (err) {
      console.error("Error toggling visibility:", err);
      alert(err.message || "Failed to toggle visibility");
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <FaStar
        key={index}
        className={index < rating ? styles.starFilled : styles.starEmpty}
      />
    ));
  };

  return (
    <div className={styles.reviewsContainer}>
      <div className={styles.header}>
        <span
          className={styles["reviews-back"]}
          onClick={() =>
            navigate("/facilities", { state: { activeTab: category } })
          }
        >
          &larr;
        </span>
        <h2 className={styles.title}>
          Reviews - {facility?.name || "Facility"}
        </h2>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Customer Reviews</h3>
        
        {loading ? (
          <p className={styles.noReviews}>Loading reviews...</p>
        ) : error ? (
          <p className={styles.noReviews} style={{ color: "#ef4444" }}>
            Error: {error}
          </p>
        ) : (
          <div className={styles.reviewsList}>
            {reviews.length === 0 ? (
              <p className={styles.noReviews}>No reviews yet.</p>
            ) : (
            reviews.map((review) => (
              <div
                key={review.id}
                className={`${styles.reviewCard} ${
                  review.hidden ? styles.reviewHidden : ""
                }`}
              >
                <div className={styles.reviewHeader}>
                  <div className={styles.reviewUser}>
                    <h4>{review.userName}</h4>
                    <div className={styles.reviewRating}>
                      {renderStars(review.rating)}
                      <span className={styles.ratingText}>
                        {review.rating}/5
                      </span>
                    </div>
                  </div>
                  <span className={styles.reviewDate}>{review.date}</span>
                </div>

                <p className={styles.reviewComment}>{review.comment}</p>

                {review.hidden && (
                  <div className={styles.hiddenBadge}>
                    <FaEyeSlash /> Hidden from public
                  </div>
                )}

                {review.adminReply && (
                  <div className={styles.adminReply}>
                    <strong>Teachers' Camp</strong>
                    <p>{review.adminReply}</p>
                  </div>
                )}

                {replyingTo === review.id ? (
                  <div className={styles.replyForm}>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your reply..."
                      rows={3}
                      className={styles.replyTextarea}
                    />
                    <div className={styles.replyActions}>
                      <button
                        className={styles.replySubmitBtn}
                        onClick={() => handleReplySubmit(review.id)}
                      >
                        Submit Reply
                      </button>
                      <button
                        className={styles.replyCancelBtn}
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.reviewActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => {
                        setReplyingTo(review.id);
                        setReplyText(review.adminReply || "");
                      }}
                    >
                      <FaReply /> {review.adminReply ? "Edit Reply" : "Reply"}
                    </button>
                    <button
                      className={styles.actionBtn}
                      onClick={() => handleToggleHidden(review.id)}
                    >
                      {review.hidden ? (
                        <>
                          <FaEye /> Unhide
                        </>
                      ) : (
                        <>
                          <FaEyeSlash /> Hide
                        </>
                      )}
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      onClick={() => handleDeleteReview(review.id)}
                    >
                      <FaTrash /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}