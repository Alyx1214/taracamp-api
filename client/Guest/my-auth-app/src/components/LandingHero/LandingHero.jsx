import React, { useState, useEffect } from 'react';
import styles from './LandingHero.module.css';
import landingHeroBg from '../../assets/homepage.png';

function LandingHero({ onReserveNow }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const fullText = "Escape the hustle, breathe in the fresh mountain air, and find solace in a place built for everyone. Whether for rest, reflection or recreation, Teachers' Camp welcomes you to a well-deserved retreat.";

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = landingHeroBg;
  }, []);

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index < fullText.length) {
        setDisplayText(fullText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 50); 

    return () => clearInterval(timer);
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
        <h1 className={`${styles.heroHeadline} ${styles.slideInLeft}`}>
          <span className={styles.line1}>Unwind,</span><br/>
          <span className={styles.line2}>Recharge,</span><br/>
          <span className={styles.line3}>& Thrive</span>
        </h1>
        <div className={`${styles.heroTextContainer} ${styles.slideInRight} ${styles.delayed}`}>
          <p className={`${styles.heroDescription} ${styles.typewriterText}`}>
            {displayText}
            <span className={styles.cursor}>|</span>
          </p>
          <button 
            className={`${styles.heroReserveButton} ${styles.magneticPulse}`} 
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