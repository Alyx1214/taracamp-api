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

const AllServices = ({
  facilities = [],
  loading = false,
  searchAttempted = false,
  loadError = null,
}) => {
  const navigate = useNavigate();
  const [defaultFacilities, setDefaultFacilities] = useState([]);
  const [fetchingDefault, setFetchingDefault] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function loadDefault() {
      if (searchAttempted) return;
      if (Array.isArray(facilities) && facilities.length > 0) return;

      setFetchingDefault(true);
      setFetchError(null);
      try {
        const res = await getAllFacilities();
        const list = Array.isArray(res?.facilities) ? res.facilities : [];
        if (!ignore) setDefaultFacilities(list);
      } catch (err) {
        if (!ignore) {
          setDefaultFacilities([]);
          const message =
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.data?.error ||
            err?.message ||
            'Failed to load facilities.';
          setFetchError(message);
        }
      } finally {
        if (!ignore) setFetchingDefault(false);
      }
    }

    loadDefault();
    return () => { ignore = true; };
  }, [facilities, searchAttempted]);

  const isLoading = Boolean(loading || fetchingDefault);
  const errorMessage = loadError || fetchError;

  const facilitiesList = Array.isArray(facilities) ? facilities : [];
  const source = searchAttempted
    ? facilitiesList
    : (facilitiesList.length > 0 ? facilitiesList : defaultFacilities);

  // Split by type and cap each to 6
  const { dorms, cottages, conferences } = useMemo(() => {
    const list = Array.isArray(source) ? source : [];
    const buckets = list.reduce((acc, item) => {
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
  }, [source]);

  const handleViewAll = (section) => {
    // route shape up to you; query param keeps it simple
    navigate(`/facilities?type=${encodeURIComponent(section)}`);
  };

  const handleCheck = (id) => {
    navigate(`/${facilityType}/${facilityName}/${id}`);
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
          View Details
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className={styles['all-services']}>
        <div className={styles.serviceSection}>
          <h2 className={styles.sectionTitle}>DORMITORIES</h2>
          <div className={styles.servicesGrid}>
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
          </div>
        </div>
        
        <div className={styles.serviceSection}>
          <h2 className={styles.sectionTitle}>COTTAGES</h2>
          <div className={styles.servicesGrid}>
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
          </div>
        </div>
        
        <div className={styles.serviceSection}>
          <h2 className={styles.sectionTitle}>CONFERENCE HALLS</h2>
          <div className={styles.servicesGrid}>
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
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className={styles['all-services']}>
        <p className={styles.error}>Error: {String(errorMessage)}</p>
      </div>
    );
  }

  const noResults =
    searchAttempted &&
    Array.isArray(facilities) &&
    facilities.length === 0 &&
    !loading &&
    !errorMessage;

  return (
    <div className={styles['all-services']}>
      {noResults && (
        <div style={{ marginBottom: '16px', color: '#475569' }}>
          <p>No facilities matched your filters. Try adjusting the controls above.</p>
        </div>
      )}
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
