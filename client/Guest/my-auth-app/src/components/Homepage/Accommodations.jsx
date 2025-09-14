import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Accommodations.module.css';
import placeholderImage from '../../assets/conference.jpg';
import { getAllFacilities } from '../../apis/facilityApi';

const TYPE_ROUTE = { CONFERENCE: 'conference', DORMITORY: 'dormitories', COTTAGE: 'cottages' };

const pickPrice = (f) => (f?.facilityType === 'Conference' ? f.price ?? '—' : f.ratePerPerson ?? '—');

const extractList = (res) => {
  if (!res) return [];
  if (Array.isArray(res.facilities)) return res.facilities;
  if (Array.isArray(res.data)) return res.data;
  if (res.data && Array.isArray(res.data.facilities)) return res.data.facilities;
  if (res.status === 200 && Array.isArray(res?.payload)) return res.payload;
  return [];
};

export default function AccommodationsSection({ limit = 6 }) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: null });

    (async () => {
      try {
        const res = await getAllFacilities();
        const payloadError = res?.error || res?.message;
        if (payloadError) {
          throw new Error(typeof payloadError === 'string' ? payloadError : 'Invalid response.');
        }

        const all = extractList(res);
        if (!Array.isArray(all)) throw new Error('Response missing "facilities" list.');

        const order = { CONFERENCE: 0, DORMITORY: 1, COTTAGE: 2 };
        const sorted = [...all].sort((a, b) => {
          const ta = order[a.facilityType] ?? 99;
          const tb = order[b.facilityType] ?? 99;
          if (ta !== tb) return ta - tb;
          return String(a.name || '').localeCompare(String(b.name || ''));
        });

        const mapped = sorted.map(f => ({
          id: f._id ?? f.id,
          name: f.name,
          type: f.facilityType,
          capacity: f.capacity,
          value: pickPrice(f),
          image: f.image || f.thumbnail || placeholderImage,
        }));

        if (!active) return;
        setItems(limit ? mapped.slice(0, limit) : mapped);
        setState({ loading: false, error: null });
      } catch (err) {
        if (!active) return;
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.data?.error ||
          err?.message ||
          'Failed to load accommodations.';
        setState({ loading: false, error: msg });
      }
    })();

    return () => { active = false; };
  }, [limit]);

  const onExploreMore = () => navigate('/user/services');

  const isLoading = state.loading;
  const hasError = !isLoading && Boolean(state.error);
  const isEmpty = !isLoading && !hasError && items.length === 0;

  return (
    <section className={styles.accommodationsSection}>
      <h2 className={styles.sectionTitle}>ACCOMMODATIONS</h2>
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
      {hasError && (
        <div className={styles.emptyState} role="alert">
          <div className={styles.emptyCard}>
            <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path fill="currentColor" d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm1-5C6.48 2 2 6.48 2 12s4.48 10 10 10
                10-4.48 10-10S17.52 2 12 2z"/>
            </svg>
            <h4 className={styles.emptyTitle}>Couldn’t load accommodations</h4>
            <p className={styles.emptyDesc}>{state.error}</p>
          </div>
        </div>
      )}
      {isEmpty && (
        <div className={styles.emptyState}>
          <div className={styles.emptyCard}>
            <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/>
            </svg>
            <h4 className={styles.emptyTitle}>No accommodations available</h4>
          </div>
        </div>
      )}
      {!isLoading && !hasError && !isEmpty && (
        <div className={styles.cardsContainer}>
          {items.map(item => {
            const routeType = TYPE_ROUTE[item.type];
            const to = `/user/services/${routeType}/${encodeURIComponent(item.id)}`;
            return (
              <Link key={item.id} to={to} className={styles.accommodationCard}>
                <div
                  className={styles.cardImagePlaceholder}
                  style={{
                    backgroundImage: `url("${item.image || placeholderImage}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                  aria-label={`${item.name} image`}
                />
                <h3 className={styles.cardTitle}>{item.name}</h3>
                {item.capacity ? (
                  <p className={styles.cardPrice}>Capacity: {item.capacity}</p>
                ) : (
                  <p className={styles.cardPrice}>Capacity: —</p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <div className={styles.bottomContent}>
        <div className={styles.bottomText}>
          <p>Your Ideal Stay Awaits.</p>
          <p>Find the Perfect Space for You!</p>
        </div>
        <button className={styles.exploreMoreButton} onClick={onExploreMore}>
          Explore More
        </button>
      </div>
    </section>
  );
}
