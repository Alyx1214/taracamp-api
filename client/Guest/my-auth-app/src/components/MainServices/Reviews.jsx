import React, { useState } from 'react';
import styles from './Reviews.module.css';

const Reviews = ({ facilityName = "Facility" }) => {
  const [reviews] = useState([
    {
      id: 1,
      name: "John Doe",
      rating: 5,
      text: "Outstanding service! The staff was incredibly professional and the facilities were spotless. I felt completely comfortable throughout my entire visit. Highly recommend this place to anyone looking for quality care.",
      date: "2 weeks ago"
    },
    {
      id: 2,
      name: "Jane Smith",
      rating: 4,
      text: "Great experience overall. The booking process was seamless and the staff was very accommodating. The only minor issue was the wait time, but the quality of service made up for it.",
      date: "1 month ago"
    },
    {
      id: 3,
      name: "Mike Johnson",
      rating: 5,
      text: "Exceptional care and attention to detail. The modern facilities and friendly staff create a welcoming atmosphere. I've been coming here for months and it's consistently excellent.",
      date: "3 weeks ago"
    },
    {
      id: 4,
      name: "Sarah Wilson",
      rating: 4,
      text: "Professional service with a personal touch. The team goes above and beyond to ensure customer satisfaction. The facility is well-maintained and the atmosphere is very calming.",
      date: "1 week ago"
    }
  ]);

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
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className={styles.reviewsContainer}>
      <div className={styles.reviewsHeader}>
        <div className={styles.headerContent}>
          <h2 className={styles.reviewsTitle}>{facilityName}</h2>
          <div className={styles.ratingOverview}>
            <div className={styles.averageRating}>
              <span className={styles.ratingNumber}>{getAverageRating()}</span>
              <div className={styles.overviewStars}>
                {renderStars(Math.round(getAverageRating()))}
              </div>
            </div>
            <div className={styles.reviewCount}>
              Based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
      
      <div className={styles.reviewsList}>
        {reviews.map((review) => (
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
            <div className={styles.reviewActions}>
              <button className={styles.helpfulBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Helpful
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reviews;