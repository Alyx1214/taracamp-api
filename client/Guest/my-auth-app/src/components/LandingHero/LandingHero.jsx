import React, { useState, useEffect } from 'react';
import styles from './LandingHero.module.css';
import landingHeroBg from '../../assets/homepage.png';

function LandingHero({ onReserveNow }) {
  const [displayText, setDisplayText] = useState('');
  const fullText = "Escape the hustle, breathe in the fresh mountain air, and find solace in a place built for everyone. Whether for rest, reflection or recreation, Teachers' Camp welcomes you to a well-deserved retreat.";

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

  return (
    <div 
      className={styles.heroSection} 
      style={{ backgroundImage: `url(${landingHeroBg})` }} id="hero"
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
          <button className={`${styles.heroReserveButton} ${styles.magneticPulse}`} onClick={onReserveNow}>
            View Services
          </button>
        </div>
      </div>
    </div>
  );
}

export default LandingHero;