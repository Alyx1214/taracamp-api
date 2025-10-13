import React from 'react';
import styles from './ServicesRates.module.css';

function MainServicesRates() {
  return (
    <section className={styles.ratesExcessSection}>
      <h2 className={styles.excessRatesTitle}>RATES IN EXCESS OF CAPACITY</h2>
      <div className={styles.excessRatesContent}>
        <p>₱200.00/pax with no provision of beddings/toiletries + 10% service fee</p>
        <p>₱270.00/pax with complete beddings/toiletries + 10% service fee</p>
        <p>₱50.00/pax for conference halls + 10% service fee</p>
      </div>
    </section>
  );
}

export default MainServicesRates;