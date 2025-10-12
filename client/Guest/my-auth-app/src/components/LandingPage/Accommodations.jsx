import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Accommodations.module.css';
import AllServices from '../MainServices/AllServices';
import { getAllFacilities } from '../../apis/facilityApi';

const extractList = (res) => {
  if (!res) return [];
  if (Array.isArray(res.facilities)) return res.facilities;
  if (Array.isArray(res.data)) return res.data;
  if (res.data && Array.isArray(res.data.facilities)) return res.data.facilities;
  if (res.status === 200 && Array.isArray(res?.payload)) return res.payload;
  return [];
};

export default function AccommodationsSection({ limit = 6 }) {
  const [facilities, setFacilities] = useState([]);
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

        if (!active) return;
        setFacilities(all);
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
  }, []);

  const onExploreMore = () => navigate('/user/services');

  return (
    <section className={styles.accommodationsSection}>
      <h2 className={styles.sectionTitle}>ACCOMMODATIONS</h2>
      
      {/* Use AllServices component instead of custom rendering */}
      <div className={styles.allServicesWrapper}>
        <AllServices 
          facilities={facilities}
          loading={state.loading}
          searchAttempted={true}
          loadError={state.error}
        />
      </div>

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
