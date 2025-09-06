import React from 'react';
import Header from '../components/Header/Header';
import LandingHero from '../components/LandingHero/LandingHero';
import Footer from '../components/Footer/Footer';
import styles from './LandingPage.module.css';
import HistorySection from '../components/LandingPage/HistorySection'; 
import ServicesSection from '../components/LandingPage/ServicesSection';  
import BoardLodgingSection from '../components/LandingPage/BoardLodgingSection';
import FAQSection from '../components/LandingPage/FAQSection';
import ResSection from '../components/LandingPage/ResSection';


function LandingPage({ onReserveNow }) {
  return (
    <div className={styles.landingPageContainer}>
      <Header onReserveNow={onReserveNow} />
      
      <main className={styles.mainContent}>
        <LandingHero onReserveNow={onReserveNow} />
        <HistorySection />
        <ServicesSection /> 
        <BoardLodgingSection /> 
        <FAQSection />
        <ResSection onReserveNow={onReserveNow} />
      </main>

      <Footer onReserveNow={onReserveNow} /> 
    </div>
  );
}

export default LandingPage;