import React from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome'; 
import LandingHero from '../LandingHero/LandingHero';
import AccommodationsSection from './Accommodations';
import BoardLodgingSection from '../LandingPage/BoardLodgingSection';
import FooterHome from '../FooterHome/FooterHome';
import styles from './Homepage.module.css';

function HomePage({ onReserveNow, isLoggedIn }) { 

  return (
    <div className={styles.homePage}>
      <HeaderHome />
      <LandingHero onReserveNow={onReserveNow} isLoggedIn={isLoggedIn} />
      <AccommodationsSection />
      <BoardLodgingSection />
      <FooterHome />
    </div>
  );
}

export default HomePage;
