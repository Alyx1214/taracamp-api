import React from 'react';
import styles from './Header.module.css';
import servicesHeaderBg from '../../assets/services-header.jpg'; 

function MainServicesHeader() {
  return (
    <div className={styles.headerSection} id="services-top" style={{ backgroundImage: `url(${servicesHeaderBg})` }}>
      <h1 className={styles.headerTitle}>SERVICES & ROOM/<br />HALL RATES</h1>
    </div>
  );
}

export default MainServicesHeader;