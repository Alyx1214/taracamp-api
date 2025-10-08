import React, { useState } from 'react';
import styles from './Reviews.module.css';

const Reviews = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reviews] = useState([
    {
      id: 1,
      name: "John Doe",
      rating: 3,
      text: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."
    },
    {
      id: 2,
      name: "Jane Smith",
      rating: 3,
      text: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."
    },
    {
      id: 3,
      name: "Mike Johnson",
      rating: 3,
      text: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."
    },
    {
      id: 4,
      name: "Sarah Wilson",
      rating: 3,
      text: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."
    }
  ]);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

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

  return (
    <>
      <button 
        onClick={openModal}
        className={styles.reviewButton}
      >
        View Reviews
      </button>
      
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>REVIEWS</h2>
              <button className={styles.closeButton} onClick={closeModal}>
                ×
              </button>
            </div>
            
            <div className={styles.reviewsContainer}>
              {reviews.map((review) => (
                <div key={review.id} className={styles.reviewCard}>
                  <div className={styles.reviewHeader}>
                    <div className={styles.avatar}></div>
                    <div className={styles.reviewInfo}>
                      <h3 className={styles.reviewerName}>{review.name}</h3>
                      <div className={styles.rating}>
                        {renderStars(review.rating)}
                      </div>
                    </div>
                  </div>
                  <p className={styles.reviewText}>{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Reviews;