import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ServicesSection.module.css';
import OptimizedImage from '../OptimizedImage/OptimizedImage';
import conferenceImage from '../../assets/conference.jpg';
import lodgingImage from '../../assets/lodging.jpg';
import eventsImage from '../../assets/events.jpg';
import recreationImage from '../../assets/recreation.jpg';

const servicesData = [
  {
    id: 1,
    title: 'CONFERENCE',
    description: 'State-of-the-art facilities perfect for large conferences, seminars, and corporate events. Equipped with modern AV technology and spacious halls.',
    image: conferenceImage,
  },
  {
    id: 2,
    title: 'LODGING',
    description: 'Comfortable and affordable accommodations for individuals and groups. Enjoy serene rooms amidst Baguio’s refreshing pine-scented air.',
    image: lodgingImage,
  },
  {
    id: 3,
    title: 'EVENTS',
    description: 'Versatile venues for various social events including weddings, birthdays, and anniversaries. Our team ensures a memorable experience for your special occasion.',
    image: eventsImage,
  },
  {
    id: 4,
    title: 'RECREATION',
    description: 'Engage in various recreational activities within the camp. From lush walking trails to sports facilities, unwind and rejuvenate.',
    image: recreationImage,
  },
];

function ServicesSection() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prevSlide) => (prevSlide + 1) % servicesData.length);
    }, 4000);

    return () => clearInterval(interval); 
  }, []); 

  const goToNextSlide = () => {
    setCurrentSlide((prevSlide) => (prevSlide + 1) % servicesData.length);
  };

  const goToPrevSlide = () => {
    setCurrentSlide((prevSlide) => (prevSlide - 1 + servicesData.length) % servicesData.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  const handleCardClick = () => {
    navigate('/user/services'); 
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      goToPrevSlide();
    } else if (event.key === 'ArrowRight') {
      goToNextSlide();
    }
  };

  return (
    <section className={styles.servicesSection} id="services-section">
      <h2 className={styles.sectionTitle}>DISCOVER OUR SERVICES</h2>
      
      <div 
        className={styles.carouselOuterWrapper}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label="Services carousel"
      >
        <button 
          className={`${styles.carouselArrow} ${styles.leftArrow}`} 
          onClick={goToPrevSlide}
          aria-label="Previous service"
        >
          &lt;
        </button>

        <div className={styles.carouselContainer}>
          <div className={styles.carouselContentWrapper}>
            {servicesData.map((service, index) => (
              <div
                key={service.id}
                className={`${styles.serviceCard} ${index === currentSlide ? styles.active : ''}`}
                onClick={handleCardClick}
                role="button"
                tabIndex={index === currentSlide ? 0 : -1}
                aria-label={`${service.title} service. Click to view more services.`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick();
                  }
                }}
              >
                <OptimizedImage
                  src={service.image}
                  alt={`${service.title} facilities at Baguio Teachers Camp`}
                  className={styles.serviceImage}
                />
                <div className={styles.cardOverlay}>
                  <h3 className={styles.cardTitle}>{service.title}</h3>
                </div>
                <div className={styles.cardBottomText}>
                  <span>Click for more services</span> 
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          className={`${styles.carouselArrow} ${styles.rightArrow}`} 
          onClick={goToNextSlide}
          aria-label="Next service"
        >
          &gt;
        </button>
      </div>

      <div className={styles.carouselDots} role="tablist" aria-label="Service navigation">
        {servicesData.map((_, index) => (
          <button
            key={index}
            className={`${styles.dot} ${index === currentSlide ? styles.activeDot : ''}`}
            onClick={() => goToSlide(index)}
            role="tab"
            aria-selected={index === currentSlide}
            aria-label={`Go to service ${index + 1}`}
          ></button>
        ))}
      </div>
    </section>
  );
}

export default ServicesSection;