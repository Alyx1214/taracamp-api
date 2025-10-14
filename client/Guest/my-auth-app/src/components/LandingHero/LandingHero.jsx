import React, { useState, useEffect } from 'react';
import styles from './LandingHero.module.css';
import landingHeroBg from '../../assets/homepage.png';

function LandingHero({ onReserveNow }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = landingHeroBg;
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onReserveNow();
    }
  };

  return (
    <section 
      className={styles.heroSection} 
      id="hero"
      role="banner"
      aria-label="Hero section"
      style={{ 
        backgroundImage: imageLoaded ? `url(${landingHeroBg})` : 'none',
        backgroundColor: imageLoaded ? 'transparent' : '#f0f0f0'
      }}
    >
      <div className={styles.heroContent}>
        <h1 className={styles.heroHeadline}>Unwind,<br/>Recharge,<br/>& Thrive</h1>
        <div className={styles.heroTextContainer}>
          <p className={styles.heroDescription}>
            Escape the hustle, breathe in the fresh mountain air, and find solace
            in a place built for everyone. Whether for rest, reflection or
            recreation, Teachers' Camp welcomes you to a well-deserved retreat.
          </p>
          <button 
            className={styles.heroReserveButton} 
            onClick={onReserveNow}
            onKeyDown={handleKeyDown}
            aria-label="View our services and make a reservation"
          >
            View Services
          </button>
        </div>
      </div>
    </section>
  );
}

export default LandingHero;