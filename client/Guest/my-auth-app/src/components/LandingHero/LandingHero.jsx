import React from 'react';
import styles from './LandingHero.module.css';
import landingHeroBg from '../../assets/homepage.png';

function LandingHero({ onReserveNow }) {
  return (
    <div 
      className={styles.heroSection} 
      style={{ backgroundImage: `url(${landingHeroBg})` }} id="hero"
    >
      <div className={styles.heroContent}>
        <h1 className={styles.heroHeadline}>Unwind,<br/>Recharge,<br/>& Thrive</h1>
        <div className={styles.heroTextContainer}>
          <p className={styles.heroDescription}>
            Escape the hustle, breathe in the fresh mountain air, and find solace
            in a place built for everyone. Whether for rest, reflection or
            recreation, Teachers' Camp welcomes you to a well-deserved retreat.
          </p>
          <button className={styles.heroReserveButton} onClick={onReserveNow}>
            View Services
          </button>
        </div>
      </div>
    </div>
  );
}

export default LandingHero;