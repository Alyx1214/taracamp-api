import React, { useEffect, useState } from 'react';
import styles from './OtherService.module.css';
import { getAllSpecialServices } from '../../apis/specialServicesApi';

function MainServicesOtherService({ facilities, loading, searchAttempted }) {
  const [defaultServices, setDefaultServices] = useState([]);
  const [fetchingDefault, setFetchingDefault] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaults() {
      if (searchAttempted) return;
      if (facilities && facilities.length > 0) return;

      setFetchingDefault(true);
      setFetchError(null);
      try {
        const data = await getAllSpecialServices();
        if (!cancelled) {
          setDefaultServices(Array.isArray(data?.specialServices) ? data.specialServices : []);
        }
      } catch (err) {
        if (!cancelled) {
          setDefaultServices([]);
          setFetchError(err?.data?.error || 'Failed to load special services.');
        }
      } finally {
        if (!cancelled) setFetchingDefault(false);
      }
    }

    loadDefaults();
    return () => { cancelled = true; };
  }, [facilities, searchAttempted]);

  const isLoading = loading || fetchingDefault;
  const displayServices = searchAttempted
    ? (facilities || [])
    : ((facilities && facilities.length > 0) ? facilities : defaultServices);

  const showNoResult = searchAttempted && !isLoading && (facilities?.length ?? 0) === 0;

  const peso = (n) => {
    const val = Number(n);
    return Number.isFinite(val)
      ? val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '—';
  };
  const nameOf = (s) => s?.name ?? s?.item ?? 'Unnamed Item';
  const priceOf = (s) => s?.price; 
  const unitOf = (s) => s?.unit || s?.per || ''; 

  return (
    <section className={styles.otherServiceSection}>
      <h2 className={styles.sectionTitle}>SPECIAL SERVICES</h2>

      <div className={styles.servicesContainer}>
        <div className={styles.servicesHeader}>
          <h3 className={styles.headerColumn}>EQUIPMENTS</h3>
          <h3 className={`${styles.headerColumn} ${styles.headerPriceColumn}`}>PRICE</h3>
        </div>

        <div className={styles.servicesList}>
          {isLoading && <div>Loading...</div>}

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
                <p>No special services found.</p>
              </div>
            </div>
          )}

          {!isLoading && !showNoResult && displayServices.map((service, idx) => (
            <div key={service.id ?? idx} className={styles.serviceItem}>
              <span className={styles.serviceName}>{nameOf(service)}</span>
              <span className={styles.servicePrice}>
                ₱{peso(priceOf(service))}{unitOf(service) ? `/${unitOf(service)}` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default MainServicesOtherService;
