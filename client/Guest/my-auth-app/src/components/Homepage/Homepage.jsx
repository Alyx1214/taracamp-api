import React from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome'; 
import LandingHero from '../LandingHero/LandingHero';
import AccommodationsSection from '../LandingPage/Accommodations';
import BoardLodgingSection from '../LandingPage/BoardLodgingSection';
import FooterHome from '../FooterHome/FooterHome';
import ReserveNow from '../BubbleButton/ReserveNow';
import styles from './Homepage.module.css';

function HomePage({ onReserveNow, isLoggedIn }) { 

  return (
    <div className={styles.homePage}>
      <HeaderHome />
      <LandingHero onReserveNow={onReserveNow} isLoggedIn={isLoggedIn} />
      <AccommodationsSection />
      <BoardLodgingSection />
      <FooterHome />

      {/* Floating Reserve Button */}
      <ReserveNow 
        navigateTo="/services"
        className={styles.floatingReserveBtn}
      >
        Reserve Now
      </ReserveNow>
    </div>
  );
}

export default HomePage;
