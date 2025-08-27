import React, { useState, useEffect } from 'react';
import styles from './Dormitories.module.css';
import dormitoryPlaceholder from '../../assets/conference.jpg';
import { Link } from 'react-router-dom';
import { getFacilitiesByType } from '../../apis/facilityApi';

function MainServicesDormitories({ facilities, loading, searchAttempted }) {
  const [defaultDorms, setDefaultDorms] = useState([]);
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
        const data = await getFacilitiesByType('DORMITORY');
        if (!cancelled) {
          setDefaultDorms(Array.isArray(data?.facilities) ? data.facilities : []);
        }
      } catch (err) {
        if (!cancelled) {
          setDefaultDorms([]);
          setFetchError(err?.data?.error || 'Failed to load dormitories.');
        }
      } finally {
        if (!cancelled) setFetchingDefault(false);
      }
    }

    loadDefault();
    return () => { cancelled = true; };
  }, [facilities, searchAttempted]);

  const isLoading = loading || fetchingDefault;

  const displayDorms = searchAttempted
    ? (facilities || [])
    : ((facilities && facilities.length > 0) ? facilities : defaultDorms);

  const showNoResult = searchAttempted && !isLoading && (facilities?.length ?? 0) === 0;

  const imgSrc = (d) => d?.image || dormitoryPlaceholder;
  const formatPeso = (n) => {
    const val = Number(n);
    return Number.isFinite(val) ? val.toLocaleString() : '—';
  };
  const formatCapacity = (c) => {
    if (typeof c === 'string' && /\bpax\b/i.test(c)) return c;
    if (c == null) return '—';
    return `${c} pax`;
    // if backend already appends "pax", we don't double it
  };

  return (
    <section className={styles.dormitoriesSection}>
      <h2 className={styles.sectionTitle}>DORMITORIES</h2>

      <div className={styles.dormitoryGrid}>
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
              <p>No dormitories found.</p>
            </div>
          </div>
        )}

        {!isLoading && !showNoResult && displayDorms.map((dorm) => (
          <div key={dorm.id} className={styles.dormitoryCard}>
            <div className={styles.dormitoryImagePlaceholder}>
              <img src={imgSrc(dorm)} alt={dorm?.name || 'Dormitory'} />
            </div>
            <h3 className={styles.dormitoryName}>{dorm?.name || 'Unnamed Dorm'}</h3>
            <p className={styles.dormitoryInfo}>Capacity: {formatCapacity(dorm?.capacity)}</p>
            <p className={styles.dormitoryRate}>
              Rates per Person : ₱ {formatPeso(dorm?.ratePerPerson ?? dorm?.rate)}
            </p>
            <Link to={`${dorm.id}`} relative="path" className={styles.checkButton}>Check</Link>
          </div>
        ))}
      </div>
    </section>
  );
}

export default MainServicesDormitories;
