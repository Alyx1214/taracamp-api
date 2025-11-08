import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  
  // Determine if we're in authenticated context (/user/services) or non-authenticated context (/services)
  const isAuthenticatedContext = location.pathname.startsWith('/user/services');
  const routePrefix = isAuthenticatedContext ? '/user/services' : '/services';
  const errorMessage = loadError;
  const isLoading = loading;
  const facilitiesList = Array.isArray(facilities) ? facilities : [];
  const source = facilitiesList;

  // Split by type and cap each to 4
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
      return (buckets[key] || []).slice(0, 4);
    };
    return {
      dorms: byType(TYPE.DORMITORY),
      cottages: byType(TYPE.COTTAGE),
      conferences: byType(TYPE.CONFERENCE),
    };
  }, [source]);

  const handleViewAll = (section) => {
    // Map the section types to the correct route paths
    const routeMap = {
      [TYPE.DORMITORY]: 'dormitories',
      [TYPE.COTTAGE]: 'cottages', 
      [TYPE.CONFERENCE]: 'conference'
    };
    
    const routePath = routeMap[section] || section.toLowerCase();
    const targetPath = `${routePrefix}/${routePath}`;
    
    if (location.pathname === targetPath) {
      // Already on the correct section, just go to top instantly
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }, 100);
    } else {
      // Navigate to the specific section and go to top instantly
      navigate(targetPath);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }, 100);
    }
  };

  const handleCheck = (item) => {
    const facilityType = item.facilityType?.toLowerCase() || 'facility';
    const facilityName = encodeURIComponent(item.name || 'facility');
    const facilityId = item._id || item.id;
    navigate(`${routePrefix}/${facilityType}/${facilityName}/${facilityId}`);
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

        <button className={styles['check-btn']} onClick={() => handleCheck(item)}>
          View Details
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className={styles['all-services']}>
        <section className={styles['service-section']}>
          <h2 className={styles['section-title']}>DORMITORIES</h2>
          <div className={styles['services-grid']}>
            {Array.from({ length: 4 }).map((_, i) => (
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
          <button className={styles['view-all-btn']} onClick={() => handleViewAll(TYPE.DORMITORY)}>
            View All
          </button>
        </section>
        
        <section className={styles['service-section']}>
          <h2 className={styles['section-title']}>COTTAGES / GUESTHOUSE</h2>
          <div className={styles['services-grid']}>
            {Array.from({ length: 4 }).map((_, i) => (
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
          <button className={styles['view-all-btn']} onClick={() => handleViewAll(TYPE.COTTAGE)}>
            View All
          </button>
        </section>
        
        <section className={styles['service-section']}>
          <h2 className={styles['section-title']}>CONFERENCES</h2>
          <div className={styles['services-grid']}>
            {Array.from({ length: 4 }).map((_, i) => (
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
          <button className={styles['view-all-btn']} onClick={() => handleViewAll(TYPE.CONFERENCE)}>
            View All
          </button>
        </section>
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
