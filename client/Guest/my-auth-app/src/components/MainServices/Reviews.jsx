import React, { useState, useEffect } from 'react';
import styles from './Reviews.module.css';
import { getReviewsByFacilityId } from '../../apis/reviewsApi';

const Reviews = ({ facilityName = "Facility", facilityId }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [averageRatings, setAverageRatings] = useState({
    location: 0,
    service: 0,
    cleanliness: 0,
    overall: 0
  });

  useEffect(() => {
    const fetchReviews = async () => {
      if (!facilityId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await getReviewsByFacilityId(facilityId);
        
        if (response.reviews) {
          // Map backend data to frontend format
          const mappedReviews = response.reviews.map((review) => {
            // Convert overall rating (1-10) to 1-5 scale for display
            const overallRating = review.rating?.overall || 0;
            const starRating = overallRating > 0 ? Math.round(overallRating / 2) : 0;
            
            // Format date
            const date = review.createdAt 
              ? formatDate(review.createdAt) 
              : "Unknown";
            
            return {
              id: review.id,
              name: review.authorName || "Anonymous",
              rating: starRating,
              text: review.text,
              date: date,
              adminReply: review.adminReply ? {
                text: review.adminReply,
                date: "Recently", // Admin replies don't have separate timestamps
                admin: "Teachers' Camp"
              } : null
            };
          });
          
          setReviews(mappedReviews);
          setAverageRatings(response.averageRatings || {
            location: 0,
            service: 0,
            cleanliness: 0,
            overall: 0
          });
        } else {
          setReviews([]);
        }
      } catch (err) {
        console.error('Error fetching reviews:', err);
        setError(err.message || 'Failed to fetch reviews');
        setReviews([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [facilityId]);

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months !== 1 ? 's' : ''} ago`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, index) => (
      <span 
        key={index} 
        className={`${styles.star} ${index < rating ? styles.filled : styles.empty}`}
      >
        ★
      </span>
    ));
  };

  const getAverageRating = () => {
    if (reviews.length === 0) return 0;
    // Use overall rating from backend (1-10 scale) converted to 1-5
    const overall = averageRatings.overall || 0;
    return (overall / 2).toFixed(1);
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className={styles.reviewsContainer}>
        <div className={styles.reviewsHeader}>
          <div className={styles.headerContent}>
            <h2 className={styles.reviewsTitle}>{facilityName}</h2>
          </div>
        </div>
        <div className={styles.reviewsList}>
          <p>Loading reviews...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.reviewsContainer}>
        <div className={styles.reviewsHeader}>
          <div className={styles.headerContent}>
            <h2 className={styles.reviewsTitle}>{facilityName}</h2>
          </div>
        </div>
        <div className={styles.reviewsList}>
          <p style={{ color: '#ef4444' }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reviewsContainer}>
      <div className={styles.reviewsHeader}>
        <div className={styles.headerContent}>
          <h2 className={styles.reviewsTitle}>{facilityName}</h2>
          {reviews.length > 0 && (
            <div className={styles.ratingOverview}>
              <div className={styles.averageRating}>
                <span className={styles.ratingNumber}>{getAverageRating()}</span>
                <div className={styles.overviewStars}>
                  {renderStars(Math.round(parseFloat(getAverageRating())))}
                </div>
              </div>
              <div className={styles.reviewCount}>
                Based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className={styles.reviewsList}>
        {reviews.length === 0 ? (
          <p>No reviews yet.</p>
        ) : (
          reviews.map((review) => (
          <div key={review.id} className={styles.reviewCard}>
            <div className={styles.reviewHeader}>
              <div 
                className={styles.avatar}
                style={{ backgroundColor: getAvatarColor(review.name) }}
              >
                <span className={styles.avatarText}>{getInitials(review.name)}</span>
              </div>
              <div className={styles.reviewInfo}>
                <div className={styles.nameContainer}>
                  <h3 className={styles.reviewerName}>{review.name}</h3>
                </div>
                <div className={styles.ratingContainer}>
                  <div className={styles.rating}>
                    {renderStars(review.rating)}
                  </div>
                  <span className={styles.reviewDate}>{review.date}</span>
                </div>
              </div>
            </div>
            <p className={styles.reviewText}>{review.text}</p>
            
            {review.adminReply && (
              <div className={styles.adminReplyContainer}>
                <div className={styles.adminReplyHeader}>
                  <div className={styles.adminBadge}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className={styles.adminLabel}>Admin Response</span>
                  </div>
                  <div className={styles.adminInfo}>
                    <span className={styles.adminName}>{review.adminReply.admin}</span>
                    <span className={styles.adminReplyDate}>{review.adminReply.date}</span>
                  </div>
                </div>
                <p className={styles.adminReplyText}>{review.adminReply.text}</p>
              </div>
            )}
          </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Reviews;