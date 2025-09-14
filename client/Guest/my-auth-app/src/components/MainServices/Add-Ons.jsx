import React, { useEffect, useState } from 'react';
import styles from './Add-Ons.module.css';
import { getAllAddons } from '../../apis/addonsApi';

function MainServicesAddOns({
  facilities,
  loading,
  searchAttempted,
  loadError,
}) {
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
        const data = await getAllAddons();

        const payloadError = data?.error || data?.message;
        const list = Array.isArray(data?.addons) ? data.addons : [];

        if (payloadError) {
          throw new Error(
            typeof payloadError === 'string'
              ? payloadError
              : 'Invalid response while loading add-ons.'
          );
        }

        if (!Array.isArray(data?.addons)) {
          throw new Error('Response missing "addons" array.');
        }

        if (!cancelled) setDefaultServices(list);
      } catch (err) {
        if (!cancelled) {
          setDefaultServices([]);
          const msg =
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.data?.error ||
            err?.message ||
            'Failed to load add-ons.';
          setFetchError(msg);
        }
      } finally {
        if (!cancelled) setFetchingDefault(false);
      }
    }

    loadDefaults();
    return () => {
      cancelled = true;
    };
  }, [facilities, searchAttempted]);

  const isLoading = Boolean(loading || fetchingDefault);
  const displayServices = searchAttempted
    ? (facilities || [])
    : (facilities && facilities.length > 0)
      ? facilities
      : defaultServices;
  const showError = !isLoading && Boolean(fetchError || loadError);
  const showNoResult = !isLoading && !showError && searchAttempted && (facilities?.length ?? 0) === 0;
  const showEmptyDefault = !isLoading && !showError && !searchAttempted && (displayServices?.length ?? 0) === 0;

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
      <h2 className={styles.sectionTitle}>ADD-ONS</h2>

      <div className={styles.servicesContainer}>
        <div className={styles.servicesHeader}>
          <h3 className={styles.headerColumn}>EQUIPMENTS</h3>
          <h3 className={`${styles.headerColumn} ${styles.headerPriceColumn}`}>PRICE</h3>
        </div>

        <div className={styles.servicesList}>
          {isLoading && (
            <div className={styles.loadingWrap} role="status" aria-live="polite" aria-busy="true">
              <div className={styles.skeletonList}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={styles.skeletonRow}>
                    <span className={styles.skelName} />
                    <span className={styles.skelPrice} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && showError && (
            <div className={styles.emptyState} role="alert">
              <div className={styles.emptyCard}>
                <svg
                  className={styles.emptyIcon}
                  viewBox="0 0 24 24"
                  width="28"
                  height="28"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm1-5C6.48 2 2 6.48 2 12s4.48 10 10 10
                  10-4.48 10-10S17.52 2 12 2z"
                  />
                </svg>
                <h4 className={styles.emptyTitle}>Couldn’t load add-ons</h4>
                <p className={styles.emptyDesc}>{fetchError || loadError}</p>
              </div>
            </div>
          )}

          {!isLoading && !showError && showNoResult && (
            <div className={styles.emptyState}>
              <div className={styles.emptyCard}>
                <svg
                  className={styles.emptyIcon}
                  viewBox="0 0 24 24"
                  width="28"
                  height="28"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5
                  6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5
                  4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5
                  9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                  />
                </svg>
                <h4 className={styles.emptyTitle}>No add-ons found</h4>
              </div>
            </div>
          )}

          {!isLoading && !showError && showEmptyDefault && (
            <div className={styles.emptyState}>
              <div className={styles.emptyCard}>
                <svg
                  className={styles.emptyIcon}
                  viewBox="0 0 24 24"
                  width="28"
                  height="28"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"
                  />
                </svg>
                <h4 className={styles.emptyTitle}>No add-ons available</h4>
              </div>
            </div>
          )}

          {!isLoading &&
            !showError &&
            !showNoResult &&
            displayServices.map((service, idx) => (
              <div key={service?._id ?? service?.id ?? idx} className={styles.serviceItem}>
                <span className={styles.serviceName}>{nameOf(service)}</span>
                <span className={styles.servicePrice}>
                  ₱{peso(priceOf(service))}
                  {unitOf(service) ? `/${unitOf(service)}` : ''}
                </span>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}

export default MainServicesAddOns;
