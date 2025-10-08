import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllFacilities } from '../../apis/facilityApi';
import styles from './AllServices.module.css';

const TYPE = Object.freeze({
  DORMITORY: 'Dormitory',
  COTTAGE: 'Cottage',
  CONFERENCE: 'Conference',
});

const toKey = (value) => String(value || '').toUpperCase();

const AllServices = () => {
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getAllFacilities(); 
        if (!ignore) {
          if (res?.status >= 200 && res?.status < 300 && Array.isArray(res?.facilities)) {
            setFacilities(res.facilities);
            setErr(null);
          } else {
            setErr(res?.error || 'Failed to load facilities');
          }
        }
      } catch (e) {
        if (!ignore) setErr(e?.message || 'Network error');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  // Split by type and cap each to 6
  const { dorms, cottages, conferences } = useMemo(() => {
    const buckets = facilities.reduce((acc, item) => {
      const key = toKey(item.facilityType);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const byType = (t) => {
      const key = toKey(t);
      return (buckets[key] || []).slice(0, 6);
    };
    return {
      dorms: byType(TYPE.DORMITORY),
      cottages: byType(TYPE.COTTAGE),
      conferences: byType(TYPE.CONFERENCE),
    };
  }, [facilities]);

  const handleViewAll = (section) => {
    // route shape up to you; query param keeps it simple
    navigate(`/facilities?type=${encodeURIComponent(section)}`);
  };

  const handleCheck = (id) => {
    navigate(`/facility/${id}`);
  };

  const ServiceCard = ({ item }) => (
    <div className={styles['service-card']}>
      <div className={styles['service-image']}>
        <img
          src={(Array.isArray(item.images) && item.images[0]) || '/placeholder-image.jpg'}
          alt={item.name}
          loading="lazy"
        />
      </div>
      <div className={styles['service-info']}>
        <h3>{item.name}</h3>
        {item.description ? <p>{item.description}</p> : null}
        {typeof item.capacity === 'number' ? (
          <p className={styles.capacity}>Capacity: {item.capacity}</p>
        ) : null}
        {/* price for Conference, ratePerPerson for Dorm/Cottage */}
        {typeof item.price === 'number' && toKey(item.facilityType) === toKey(TYPE.CONFERENCE) ? (
          <p className={styles.price}>Price: ₱{item.price.toLocaleString()}</p>
        ) : null}
        {typeof item.ratePerPerson === 'number' &&
        (toKey(item.facilityType) === toKey(TYPE.DORMITORY) || toKey(item.facilityType) === toKey(TYPE.COTTAGE)) ? (
          <p className={styles.price}>Rate per person: ₱{item.ratePerPerson.toLocaleString()}</p>
        ) : null}

        <button className={styles['check-btn']} onClick={() => handleCheck(item._id || item.id)}>
          Check
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={styles['all-services']}>
        <p>Loading facilities… try not to blink.</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className={styles['all-services']}>
        <p className={styles.error}>Error: {String(err)}</p>
      </div>
    );
  }

  return (
    <div className={styles['all-services']}>
      {/* Dormitories */}
      <section className={styles['service-section']}>
        <h2 className={styles['section-title']}>DORMITORIES</h2>
        <div className={styles['services-grid']}>
          {dorms.map((d) => (
            <ServiceCard key={d._id || d.id} item={d} />
          ))}
          {dorms.length === 0 && <p>No dormitories found.</p>}
        </div>
        <button className={styles['view-all-btn']} onClick={() => handleViewAll(TYPE.DORMITORY)}>
          View All
        </button>
      </section>

      {/* Cottages */}
      <section className={styles['service-section']}>
        <h2 className={styles['section-title']}>COTTAGES / GUESTHOUSE</h2>
        <div className={styles['services-grid']}>
          {cottages.map((c) => (
            <ServiceCard key={c._id || c.id} item={c} />
          ))}
          {cottages.length === 0 && <p>No cottages found.</p>}
        </div>
        <button className={styles['view-all-btn']} onClick={() => handleViewAll(TYPE.COTTAGE)}>
          View All
        </button>
      </section>

      {/* Conferences */}
      <section className={styles['service-section']}>
        <h2 className={styles['section-title']}>CONFERENCES</h2>
        <div className={styles['services-grid']}>
          {conferences.map((x) => (
            <ServiceCard key={x._id || x.id} item={x} />
          ))}
          {conferences.length === 0 && <p>No conference halls found.</p>}
        </div>
        <button className={styles['view-all-btn']} onClick={() => handleViewAll(TYPE.CONFERENCE)}>
          View All
        </button>
      </section>
    </div>
  );
};

export default AllServices;
