import React, { useState, useEffect } from 'react';
import styles from './Cottages.module.css';
import placeholderImage from '../../assets/conference.jpg';
import { Link } from 'react-router-dom';
import { getFacilitiesByType } from '../../apis/facilityApi';

function MainServicesCottages({ facilities, loading, searchAttempted }) {
  const [defaultCottages, setDefaultCottages] = useState([]);
  const [fetchingDefault, setFetchingDefault] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDefault() {
      if (searchAttempted) return;
      if (facilities && facilities.length > 0) return;

      setFetchingDefault(true);
      setFetchError(null);
      try {
        const data = await getFacilitiesByType('COTTAGE');
        if (!cancelled) {
          setDefaultCottages(Array.isArray(data?.facilities) ? data.facilities : []);
        }
      } catch (err) {
        if (!cancelled) {
          setDefaultCottages([]);
          setFetchError(err?.data?.error || 'Failed to load cottages.');
        }
      } finally {
        if (!cancelled) setFetchingDefault(false);
      }
    }

    loadDefault();
    return () => { cancelled = true; };
  }, [facilities, searchAttempted]);

  const isLoading = loading || fetchingDefault;

  const displayCottages = searchAttempted
    ? (facilities || [])
    : ((facilities && facilities.length > 0) ? facilities : defaultCottages);

  const showNoResult = searchAttempted && !isLoading && (facilities?.length ?? 0) === 0;

  const formatPeso = (n) => {
    const val = Number(n);
    return Number.isFinite(val) ? val.toLocaleString() : '—';
  };
  const imgSrc = (c) => c?.image || placeholderImage;

  return (
    <section className={styles.cottagesSection}>
      <h2 className={styles.sectionTitle}>COTTAGES / GUESTHOUSE</h2>

      <div className={styles.cottageGrid}>
        {isLoading && <p>Loading...</p>}

        {!isLoading && fetchError && (
          <div className={styles.noFacilities}>
            <div className={styles.softCard}>
              <p style={{ color: 'crimson' }}>{fetchError}</p>
            </div>
          </div>
        )}

        {showNoResult && (
          <div className={styles.noFacilities}>
            <div className={styles.softCard}>
              <p>No cottages found.</p>
            </div>
          </div>
        )}

        {!isLoading && !showNoResult && displayCottages.map((cottage) => (
          <div key={cottage.id} className={styles.cottageCard}>
            <div className={styles.cottageImagePlaceholder}>
              <img src={imgSrc(cottage)} alt={cottage?.name || 'Cottage'} />
            </div>
            <div className={styles.cardContent}>
              <h3 className={styles.cottageName}>{cottage?.name || 'Unnamed Cottage'}</h3>
              <p className={styles.cottageRate}>
                Rates per Person : ₱ {formatPeso(cottage?.ratePerPerson ?? cottage?.rate)}
              </p>
              <Link to={`${cottage.id}`} relative="path" className={styles.checkButton}>Check</Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default MainServicesCottages;
