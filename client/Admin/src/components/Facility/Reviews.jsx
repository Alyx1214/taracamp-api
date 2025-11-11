import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaStar, FaReply, FaTrash, FaEyeSlash, FaEye } from "react-icons/fa";
import styles from "./Reviews.module.css";

export default function Reviews() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { category, facility } = location.state || {};

  const [reviews, setReviews] = useState([
    {
      id: 1,
      userName: "John Doe",
      rating: 5,
      comment: "Amazing facility! Very clean and well-maintained.",
      date: "2024-11-10",
      hidden: false,
      adminReply: null,
    },
    {
      id: 2,
      userName: "Jane Smith",
      rating: 4,
      comment: "Good experience overall, staff was friendly.",
      date: "2024-11-08",
      hidden: false,
      adminReply: "Thank you for your feedback!",
    },
    {
      id: 3,
      userName: "Mike Johnson",
      rating: 3,
      comment: "Decent place but could use some improvements.",
      date: "2024-11-05",
      hidden: false,
      adminReply: null,
    },
  ]);

  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    // TODO: Fetch reviews from API
  }, [id]);

  const handleReplySubmit = (reviewId) => {
    if (!replyText.trim()) return;

    setReviews((prev) =>
      prev.map((review) =>
        review.id === reviewId
          ? { ...review, adminReply: replyText }
          : review
      )
    );

    setReplyingTo(null);
    setReplyText("");
    // TODO: API call to save reply
  };

  const handleDeleteReview = (reviewId) => {
    if (window.confirm("Are you sure you want to delete this review?")) {
      setReviews((prev) => prev.filter((review) => review.id !== reviewId));
      // TODO: API call to delete review
    }
  };

  const handleToggleHidden = (reviewId) => {
    setReviews((prev) =>
      prev.map((review) =>
        review.id === reviewId
          ? { ...review, hidden: !review.hidden }
          : review
      )
    );
    // TODO: API call to toggle visibility
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
      </div>
    </div>
  );
}