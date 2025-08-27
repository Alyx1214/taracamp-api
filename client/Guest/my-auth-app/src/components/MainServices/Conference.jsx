import React, { useState, useEffect } from 'react';
import styles from './Conference.module.css';
import placeholderImage from '../../assets/conference.jpg';
import { Link } from 'react-router-dom';
import { getFacilitiesByType } from '../../apis/facilityApi';

function MainServicesConference({ facilities, loading, searchAttempted }) {
  const [defaultConferences, setDefaultConferences] = useState([]);
  const [fetchingDefault, setFetchingDefault] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDefault() {
      if (searchAttempted) return; // if user searched, don't auto-fetch defaults
      if (facilities && facilities.length > 0) return; // already have explicit data

      setFetchingDefault(true);
      setFetchError(null);
      try {
        const data = await getFacilitiesByType('CONFERENCE');
        if (!cancelled) {
          setDefaultConferences(Array.isArray(data?.facilities) ? data.facilities : []);
        }
      } catch (err) {
        if (!cancelled) {
          setDefaultConferences([]);
          setFetchError(err?.data?.error || 'Failed to load conference halls.');
        }
      } finally {
        if (!cancelled) setFetchingDefault(false);
      }
    }

    loadDefault();
    return () => { cancelled = true; };
  }, [facilities, searchAttempted]);

  const isLoading = loading || fetchingDefault;

  // IMPORTANT: when a search has been attempted, trust the search results even if empty
  const displayConferences = searchAttempted
    ? (facilities || [])
    : ((facilities && facilities.length > 0) ? facilities : defaultConferences);

  const showNoResult = searchAttempted && !isLoading && (facilities?.length ?? 0) === 0;

  const formatPrice = (price) => {
    const n = Number(price);
    return Number.isFinite(n) ? n.toLocaleString() : '—';
  };
  const imgSrc = (hall) => hall?.image || placeholderImage;

  return (
    <section className={styles.conferenceSection}>
      <h2 className={styles.sectionTitle}>CONFERENCE HALLS</h2>

      <div className={styles.conferenceGrid}>
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
              <p>No conference halls found.</p>
            </div>
          </div>
        )}

        {!isLoading && !showNoResult && displayConferences.map((hall) => (
          <div key={hall.id} className={styles.conferenceCard}>
            <div className={styles.conferenceImagePlaceholder}>
              <img src={imgSrc(hall)} alt={hall?.name || 'Conference hall'} />
            </div>
            <div className={styles.cardContent}>
              <h3 className={styles.conferenceName}>{hall?.name || 'Unnamed Hall'}</h3>
              {hall?.capacity && (
                <p className={styles.conferenceCapacity}>Capacity: {hall.capacity}</p>
              )}
              <p className={styles.conferencePrice}>Price : ₱ {formatPrice(hall?.price)}</p>
              <Link to={`${hall.id}`} relative="path" className={styles.checkButton}>Check</Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default MainServicesConference;
