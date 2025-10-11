import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from '../Header/Header';
import Footer from '../Footer/Footer';
import styles from './MainServices.module.css';
import MainServicesHeader from './Header';
import MainServicesNavSearch from './NavSearch';
import MainServicesDormitories from './Dormitories';
import MainServicesCottages from './Cottages';
import MainServicesRates from './ServicesRates';
import MainServicesConference from './Conference';
import MainServicesAddOns from './Add-Ons';
import MainServicesServiceDetail from './ServiceDetail';
import Controls from './Controls';
import { searchFacilities } from '../../apis/facilityApi';
import { searchAddons } from '../../apis/addonsApi';
import AllServices from './AllServices';

const LABEL_TO_ENUM = {
  Dormitory: 'Dormitory',
  Cottage: 'Cottage',
  Conference: 'Conference',
  All: null,
  'Add-Ons': null,
};

const toISO = (d) => {
  if (!d) return undefined;
  const x = new Date(d);
  if (Number.isNaN(x)) return undefined;
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
};

function MainServices() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const facilityType = useMemo(() => {
    const p = location.pathname;
    if (p.includes('/all')) return 'All';
    if (p.includes('/dormitories')) return 'Dormitory';
    if (p.includes('/cottages')) return 'Cottage';
    if (p.includes('/conference')) return 'Conference';
    if (p.includes('/add-ons')) return 'Add-Ons';
    return '';
  }, [location.pathname]);

  useEffect(() => {
    setFacilities([]);
    setSearchAttempted(false);
    setError(null);
  }, [facilityType]);


  const handleApplyFilters = useCallback(async (filters = {}) => {
    setLoading(true);
    setSearchAttempted(true);
    setError(null);

    try {
      if (facilityType === 'Add-Ons' && !filters?.type) {
        const params = {
          query: filters?.query,
          minPrice: filters?.minPrice,
          maxPrice: filters?.maxPrice,
          unit: filters?.unit,
        };
        const data = await searchAddons(params);
        setFacilities(Array.isArray(data?.addons) ? data.addons : []);
      } else {
        const resolvedType = (filters?.type ?? LABEL_TO_ENUM[facilityType]) ?? null;

        const params = {
          type: resolvedType,
          minPrice: filters?.minPrice,
          maxPrice: filters?.maxPrice,
          capacity: filters?.capacity,
          checkInDate: toISO(filters?.checkInDate),
          checkOutDate: toISO(filters?.checkOutDate),
          query: filters?.query,
        };

        const data = await searchFacilities(params);
        setFacilities(Array.isArray(data?.facilities) ? data.facilities : []);
      }
    } catch (err) {
      setFacilities([]);
      setError(err?.data?.error || 'Filter failed.');
    } finally {
      setLoading(false);
    }
  }, [facilityType]);

  
  async function handleSearch(query) {
    if (!query?.trim() || !facilityType) return;
    setLoading(true);
    setSearchAttempted(true);
    setError(null);

    try {
      if (facilityType === 'Add-Ons') {
        const data = await searchAddons({ query });
        setFacilities(Array.isArray(data?.addons) ? data.addons : []);
      } else {
        const resolvedType = LABEL_TO_ENUM[facilityType] ?? null;
        const data = await searchFacilities({ type: resolvedType, query });
        setFacilities(Array.isArray(data?.facilities) ? data.facilities : []);
      }
    } catch (err) {
      setFacilities([]);
      setError(err?.data?.error || 'Search failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleClearSearch() {
    setFacilities([]);
    setSearchAttempted(false);
    setError(null);
  }

  function handleReserveNow() {
    navigate('/auth/login');
  }

  const isDetailViewOrAddOn =
    (location.pathname.includes('/all/') && location.pathname.split('/').length === 4) ||
    (location.pathname.includes('/dormitories/') && location.pathname.split('/').length > 4) ||
    (location.pathname.includes('/cottages/') && location.pathname.split('/').length > 4) ||
    (location.pathname.includes('/conference/') && location.pathname.split('/').length > 4) ||
    facilityType === 'Add-Ons';

  const shouldShowControls = !isDetailViewOrAddOn;

  return (
    <div className={styles.mainServicesPageContainer}>
      <Navbar onReserveNow={handleReserveNow} />

      <main className={styles.mainContent}>
        <MainServicesHeader />

        <div className={styles.contentWrapper}>
          <MainServicesNavSearch
            onSearch={handleSearch}
            onClearSearch={handleClearSearch}
            onApplyFilters={handleApplyFilters}
          />

          {error && (
            <div style={{ margin: '8px 0', color: 'crimson', fontSize: '0.95rem' }}>
              {error}
            </div>
          )}

          {shouldShowControls && (
            <Controls
              facilityType={facilityType || 'All'}
              onApplyFilters={handleApplyFilters}
            />
          )}

          <Routes>
            <Route path="*" element={<Navigate to="all" replace />} />
            <Route
              path="all"
              element={(
                <AllServices
                  facilities={facilities}
                  loading={loading}
                  searchAttempted={searchAttempted}
                  loadError={error}   
                />
              )}
            />
            <Route index element={<Navigate to="all" replace />} />
            <Route
              path="dormitories"
              element={
                <MainServicesDormitories
                  facilities={facilities}
                  loading={loading}
                  searchAttempted={searchAttempted}
                  loadError={error}   
                />
              }
            />
            <Route
              path="cottages"
              element={
                <MainServicesCottages
                  facilities={facilities}
                  loading={loading}
                  searchAttempted={searchAttempted}
                  loadError={error}   
                />
              }
            />
            <Route
              path="conference"
              element={
                <MainServicesConference
                  facilities={facilities}
                  loading={loading}
                  searchAttempted={searchAttempted}
                  loadError={error}   
                />
              }
            />
            <Route
              path="add-ons"
              element={
                <MainServicesAddOns
                  facilities={facilities}
                  loading={loading}
                  searchAttempted={searchAttempted}
                />
              }
            />
            <Route path=":type/:name/:id" element={<MainServicesServiceDetail />} />
          </Routes>

          {!isDetailViewOrAddOn && <MainServicesRates />}
        </div>
      </main>

      <Footer onReserveNow={handleReserveNow} />
    </div>
  );
}

export default MainServices;
