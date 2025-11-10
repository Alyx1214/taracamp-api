import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaStar, FaReply, FaTrash, FaEyeSlash, FaEye } from "react-icons/fa";
import styles from "./Manage.module.css";

export default function Manage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { category, facility } = location.state || {};

  const [formData, setFormData] = useState({
    capacity: "",
    quantity: "",
    extraRows: [],
  });

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load facility data and reviews
    // TODO: Fetch from API
    if (facility) {
      setFormData({
        capacity: facility.capacity || "",
        quantity: facility.quantity || "",
        extraRows: facility.extraRows || [],
      });
    }
  }, [facility]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddRow = () => {
    setFormData((prev) => ({
      ...prev,
      extraRows: [...prev.extraRows, { capacity: "", quantity: "" }],
    }));
  };

  const handleRemoveRow = (index) => {
    setFormData((prev) => {
      const extra = Array.from(prev.extraRows);
      extra.splice(index, 1);
      return { ...prev, extraRows: extra };
    });
  };

  const handleExtraRowChange = (index, field, value) => {
    setFormData((prev) => {
      const extra = Array.from(prev.extraRows);
      extra[index] = { ...extra[index], [field]: value };
      return { ...prev, extraRows: extra };
    });
  };

  const handleSaveRooms = async () => {
    setLoading(true);
    try {
      // TODO: API call to save room configuration
      console.log("Saving room data:", formData);
      setTimeout(() => {
        alert("Room configuration saved successfully!");
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Error saving rooms:", error);
      setLoading(false);
    }
  };

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
    <div className={styles.manageContainer}>
      <div className={styles.header}>
        <span
          className={styles["manage-back"]}
          onClick={() =>
            navigate("/facilities", { state: { activeTab: category } })
          }
        >
          &larr;
        </span>
        <h2 className={styles.title}>
          Manage {facility?.name || "Facility"}
        </h2>
      </div>

      {/* Room Configuration Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Manage Room</h3>
        
        <div className={styles.formRow}>
          <label>
            Capacity:
            <input
              type="number"
              name="capacity"
              value={formData.capacity}
              onChange={handleChange}
              placeholder="Enter capacity"
            />
          </label>

          <label>
            Quantity:
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="Enter quantity"
            />
          </label>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button
              type="button"
              className={styles.addBtn}
              onClick={handleAddRow}
            >
              <span className={styles.btnIcon}>+</span>
              Add
            </button>
          </div>
        </div>

        {formData.extraRows.map((row, idx) => (
          <div className={styles.formRow} key={`extra-row-${idx}`}>
            <label>
              Capacity:
              <input
                type="number"
                value={row.capacity}
                onChange={(e) =>
                  handleExtraRowChange(idx, "capacity", e.target.value)
                }
                placeholder="Enter capacity"
              />
            </label>

            <label>
              Quantity:
              <input
                type="number"
                value={row.quantity}
                onChange={(e) =>
                  handleExtraRowChange(idx, "quantity", e.target.value)
                }
                placeholder="Enter quantity"
              />
            </label>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => handleRemoveRow(idx)}
              >
                <span className={styles.btnIcon}>×</span>
                Remove
              </button>
            </div>
          </div>
        ))}

        <div className={styles.buttonContainer}>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSaveRooms}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {/* Reviews Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Customer Reviews</h3>
        
        <div className={styles.reviewsContainer}>
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