import React, { useState, useEffect } from 'react';
import styles from './Cottages.module.css';
import placeholderImage from '../../assets/conference.jpg';
import { Link } from 'react-router-dom';
import { getFacilitiesByType } from '../../apis/facilityApi';

function MainServicesCottages({
  facilities,
  loading,
  searchAttempted,
  loadError,
}) {
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
        const data = await getFacilitiesByType('Cottage');

        const payloadError = data?.error || data?.message;
        const list = Array.isArray(data?.facilities) ? data.facilities : [];

        if (payloadError) {
          throw new Error(
            typeof payloadError === 'string'
              ? payloadError
              : 'Invalid response while loading cottages.'
          );
        }
        if (!Array.isArray(data?.facilities)) {
          throw new Error('Response missing "facilities" array.');
        }

        if (!cancelled) setDefaultCottages(list);
      } catch (err) {
        if (!cancelled) {
          setDefaultCottages([]);
          const msg =
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.data?.error ||
            err?.message ||
            'Failed to load cottages.';
          setFetchError(msg);
        }
      } finally {
        if (!cancelled) setFetchingDefault(false);
      }
    }

    loadDefault();
    return () => { cancelled = true; };
  }, [facilities, searchAttempted]);

  const isLoading = Boolean(loading || fetchingDefault);

  const displayCottages = searchAttempted
    ? (facilities || [])
    : (facilities && facilities.length > 0 ? facilities : defaultCottages);

  const showError = !isLoading && Boolean(fetchError || loadError);
  const showNoResult = !isLoading && !showError && searchAttempted && (facilities?.length ?? 0) === 0;
  const showEmptyDefault = !isLoading && !showError && !searchAttempted && (displayCottages?.length ?? 0) === 0;

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
  const imgSrc = (c) => c?.image || placeholderImage;

  return (
    <section className={styles.cottagesSection}>
      <h2 className={styles.sectionTitle}>COTTAGES / GUESTHOUSE</h2>

      <div className={styles.cottageGrid}>
        {isLoading && (
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

        {!isLoading && showError && (
          <div className={styles.emptyState} role="alert">
            <div className={styles.emptyCard}>
              <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path fill="currentColor" d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm1-5C6.48 2 2 6.48 2 12s4.48 10 10 10
                  10-4.48 10-10S17.52 2 12 2z"/>
              </svg>
              <h4 className={styles.emptyTitle}>Couldn’t load cottages</h4>
              <p className={styles.emptyDesc}>{fetchError || loadError}</p>
            </div>
          </div>
        )}

        {!isLoading && !showError && showNoResult && (
          <div className={styles.emptyState}>
            <div className={styles.emptyCard}>
              <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5
                  6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5
                  4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5
                  9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <h4 className={styles.emptyTitle}>No cottages found</h4>
            </div>
          </div>
        )}

        {!isLoading && !showError && showEmptyDefault && (
          <div className={styles.emptyState}>
            <div className={styles.emptyCard}>
              <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/>
              </svg>
              <h4 className={styles.emptyTitle}>No cottages available</h4>
            </div>
          </div>
        )}

        {!isLoading && !showError && !showNoResult && displayCottages.map((cottage, idx) => (
          <div key={cottage?._id ?? cottage?.id ?? idx} className={styles.cottageCard}>
            <div className={styles.cottageImagePlaceholder}>
              <img src={imgSrc(cottage)} alt={cottage?.name || 'Cottage'} />
            </div>
            <div className={styles.cardContent}>
              <h3 className={styles.cottageName}>{cottage?.name || 'Unnamed Cottage'}</h3>
              <p className={styles.cottageInfo}>Capacity: {formatCapacity(cottage?.capacity)}</p>
              <p className={styles.cottageRate}>
                Rates per Person : ₱ {formatPeso(cottage?.ratePerPerson ?? cottage?.rate)}
              </p>
              <Link to={`${cottage?._id ?? cottage?.id ?? ''}`} relative="path" className={styles.checkButton}>
                Check
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default MainServicesCottages;
