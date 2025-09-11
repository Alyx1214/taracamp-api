import React, { useState, useEffect, useMemo } from 'react';
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
import { searchFacilities } from '../../apis/facilityApi';
import { searchSpecialServices } from '../../apis/specialServicesApi';

function MainServices() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const facilityType = useMemo(() => {
    const p = location.pathname;
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

  async function handleSearch(query) {
    if (!query?.trim() || !facilityType) return;
    setLoading(true);
    setSearchAttempted(true);
    setError(null);

    try {
      if (facilityType === 'Add-Ons') {
        const data = await searchSpecialServices({ query });
        setFacilities(Array.isArray(data?.specialServices) ? data.specialServices : []);
      } else {
        const data = await searchFacilities({ type: facilityType, query });
        setFacilities(Array.isArray(data?.facilities) ? data.facilities : []);
      }
    } catch (err) {
      setFacilities([]);
      setError(err?.data?.error || 'Search failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyFilters(filters) {
    setLoading(true);
    setSearchAttempted(true);
    setError(null);

    try {
      if (facilityType === 'Add-Ons') {
        const params = {
          query: filters?.query,
          minPrice: filters?.minPrice,
          maxPrice: filters?.maxPrice,
          unit: filters?.unit,
        };
        const data = await searchSpecialServices(params);
        setFacilities(Array.isArray(data?.specialServices) ? data.specialServices : []);
      } else {
        const params = {
          type: facilityType,
          minPrice: filters?.minPrice,
          maxPrice: filters?.maxPrice,
          capacity: filters?.capacity,
          checkInDate: filters?.checkInDate,
          checkOutDate: filters?.checkOutDate,
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
    (location.pathname.includes('/dormitories/') && location.pathname.split('/').length > 3) ||
    (location.pathname.includes('/cottages/') && location.pathname.split('/').length > 3) ||
    (location.pathname.includes('/conference/') && location.pathname.split('/').length > 3) ||
    facilityType === 'Add-Ons';

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

          <Routes>
            <Route index element={<Navigate to="dormitories" replace />} />
            <Route
              path="dormitories"
              element={
                <MainServicesDormitories
                  facilities={facilities}
                  loading={loading}
                  searchAttempted={searchAttempted}
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
            <Route path=":type/:id" element={<MainServicesServiceDetail />} />
          </Routes>

          {!isDetailViewOrAddOn && <MainServicesRates />}
        </div>
      </main>

      <Footer onReserveNow={handleReserveNow} />
    </div>
  );
}

export default MainServices;
