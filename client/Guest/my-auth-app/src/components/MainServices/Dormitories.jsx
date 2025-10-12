import React from 'react';
import styles from './Dormitories.module.css';
import dormitoryPlaceholder from '../../assets/conference.jpg';
import { Link } from 'react-router-dom';

function MainServicesDormitories({
  facilities,
  loading,
  searchAttempted,
  loadError, 
}) {
  const availableFacilities = Array.isArray(facilities) ? facilities : [];
  const displayDorms = availableFacilities;

  const showError = !loading && Boolean(loadError);
  const showNoResult = !loading && !showError && searchAttempted && availableFacilities.length === 0;
  const showEmptyDefault = !loading && !showError && !searchAttempted && (displayDorms?.length ?? 0) === 0;

  const imgSrc = (d) => d?.images[0] || dormitoryPlaceholder;
  const formatPeso = (n) => {
    const val = Number(n);
    return Number.isFinite(val)
      ? val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '—';
  };
  const formatCapacity = (c) => {
    if (typeof c === 'string' && /\bpax\b/i.test(c)) return c;
    if (c == null) return '—';
    return `${c} pax`;
  };

  return (
    <section className={styles.dormitoriesSection}>
      <h2 className={styles.sectionTitle}>DORMITORIES</h2>

      <div className={styles.dormitoryGrid}>
        {loading && (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skelImg} />
                <div className={styles.skelBody}>
                  <span className={styles.skelLine} />
                  <span className={styles.skelLineShort} />
                  <span className={styles.skelLineShorter} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && showError && (
          <div className={styles.emptyState} role="alert">
            <div className={styles.emptyCard}>
              <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path fill="currentColor" d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm1-5C6.48 2 2 6.48 2 12s4.48 10 10 10
                  10-4.48 10-10S17.52 2 12 2z"/>
              </svg>
              <h4 className={styles.emptyTitle}>Couldn't load dormitories</h4>
              <p className={styles.emptyDesc}>{loadError}</p>
            </div>
          </div>
        )}

        {!loading && !showError && showNoResult && (
          <div className={styles.emptyState}>
            <div className={styles.emptyCard}>
              <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5
                  6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5
                  4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5
                  9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <h4 className={styles.emptyTitle}>No dormitories found</h4>
            </div>
          </div>
        )}

        {!loading && !showError && showEmptyDefault && (
          <div className={styles.emptyState}>
            <div className={styles.emptyCard}>
              <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/>
              </svg>
              <h4 className={styles.emptyTitle}>No dormitories available</h4>
            </div>
          </div>
        )}

        {!loading && !showError && !showNoResult && displayDorms.map((dorm, idx) => (
          <div key={dorm?._id ?? dorm?.id ?? idx} className={styles.dormitoryCard}>
            <div className={styles.dormitoryImagePlaceholder}>
              <img src={imgSrc(dorm)} alt={dorm?.name || 'Dormitory'} />
            </div>
            <div className={styles.cardContent}>
              <h3 className={styles.dormitoryName}>{dorm?.name || 'Unnamed Dorm'}</h3>
              <p className={styles.dormitoryInfo}>Capacity: {formatCapacity(dorm?.capacity)}</p>
              <p className={styles.dormitoryRate}>
                Rates per Person : ₱ {formatPeso(dorm?.ratePerPerson ?? dorm?.rate)}
              </p>
              <Link to={`${dorm?.name?.replace(/\s+/g, '-').toLowerCase() || 'unnamed'}/${dorm?._id ?? dorm?.id ?? ''}`} className={styles.checkButton}>
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default MainServicesDormitories;
