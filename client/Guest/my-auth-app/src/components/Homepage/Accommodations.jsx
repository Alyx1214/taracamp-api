import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Accommodations.module.css';
import placeholderImage from '../../assets/conference.jpg';
import { getAllFacilities } from '../../apis/facilityApi'; 

const TYPE_ROUTE = {
  CONFERENCE: 'conference',
  DORMITORY: 'dormitories',
  COTTAGE: 'cottages',
};

const pickPrice = (f) => {
  if (f?.facilityType === 'CONFERENCE') return f.price ?? '—';
  return f.ratePerPerson ?? '—';
};

const extractList = (res) => {
  if (!res || res.status !== 200) return [];
  if (Array.isArray(res.facilities)) return res.facilities;
  if (Array.isArray(res.data)) return res.data;
  if (res.data && Array.isArray(res.data.facilities)) return res.data.facilities;
  return [];
};

export default function AccommodationsSection({ limit = 6 }) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: null });

    getAllFacilities()
      .then((res) => {
        if (!active) return;
        const all = extractList(res);

        const order = { CONFERENCE: 0, DORMITORY: 1, COTTAGE: 2 };
        const sorted = [...all].sort((a, b) => {
          const ta = order[a.facilityType] ?? 99;
          const tb = order[b.facilityType] ?? 99;
          if (ta !== tb) return ta - tb;
          return String(a.name).localeCompare(String(b.name));
        });

        const mapped = sorted.map(f => ({
          id: f._id,
          name: f.name,
          type: f.facilityType,
          capacity: f.capacity,
          value: pickPrice(f),
          image: f.image || f.thumbnail || null,
        }));

        setItems(limit ? mapped.slice(0, limit) : mapped);
        setState({ loading: false, error: null });
      })
      .catch((err) => {
        if (!active) return;
        setState({ loading: false, error: err?.message || 'Failed to load accommodations.' });
      });

    return () => { active = false; };
  }, [limit]);

  const onExploreMore = () => {
    navigate('/user/services');
  };

  return (
    <section className={styles.accommodationsSection}>
      <h2 className={styles.sectionTitle}>ACCOMMODATIONS</h2>

      {state.loading && <div className={styles.loading}>Loading…</div>}
      {state.error && <div className={styles.error} role="alert">{state.error}</div>}

      {!state.loading && !state.error && (
        <div className={styles.cardsContainer}>
          {items.map(item => {
            const routeType = TYPE_ROUTE[item.type] || item.type?.toLowerCase();
            const to = `/user/services/${routeType}/${encodeURIComponent(item.id)}`;
            return (
              <Link key={item.id} to={to} className={styles.accommodationCard}>
                <div
                  className={styles.cardImagePlaceholder}
                  style={{ backgroundImage: `url("${item.image || placeholderImage}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                  aria-label={`${item.name} image`}
                />
                <h3 className={styles.cardTitle}>{item.name}</h3>
                <p className={styles.cardPrice}>
                  {item.type === 'CONFERENCE' ? 'Price' : 'Rate per person'}: ₱ {item.value}
                </p>
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
