// Services.jsx
import React, { useState } from 'react';
import { useNavigate, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import FooterHome from '../FooterHome/FooterHome';
import styles from '../MainServices/MainServices.module.css';
import MainServicesHeader from '../MainServices/Header';
import MainServicesNavSearch from '../MainServices/NavSearch';
import MainServicesDormitories from '../MainServices/Dormitories';
import MainServicesCottages from '../MainServices/Cottages';
import MainServicesRates from '../MainServices/ServicesRates';
import MainServicesConference from '../MainServices/Conference';
import MainServicesAddOns from '../MainServices/Add-Ons';
import MainServicesServiceDetail from '../MainServices/ServiceDetail';
import { searchFacilities } from '../../apis/facilityApi'; 

function Services() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const API = import.meta.env.VITE_API_URL; 

  const getFacilityTypeFromPath = (pathname) => {
    if (pathname.includes('/dormitories')) return 'Dormitory';
    if (pathname.includes('/cottages')) return 'Cottage';
    if (pathname.includes('/conference')) return 'Conference';
    if (pathname.includes('/other-service')) return 'Other Service';
    return '';
  };

  const facilityType = getFacilityTypeFromPath(location.pathname);

  const handleSearch = async (query) => {
    if (!query.trim() || !facilityType) return;
    setLoading(true);
    setSearchAttempted(true);
    try {
      const res = await searchFacilities({ type: facilityType, query });
      if (res?.status === 200) {
        const list =
          Array.isArray(res.facilities) ? res.facilities :
          Array.isArray(res.data) ? res.data :
          Array.isArray(res?.data?.facilities) ? res.data.facilities : [];
        setFacilities(list);
      } else {
        setFacilities([]);
      }
    } catch (err) {
      console.error('Search failed:', err);
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setFacilities([]);
    setSearchAttempted(false);
  };

  const handleApplyFilters = async (filters) => {
    setLoading(true);
    setSearchAttempted(true);
    try {
      const params = {
        type: facilityType,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        capacity: filters.capacity || undefined,
        checkInDate: filters.checkInDate || undefined,
        checkOutDate: filters.checkOutDate || undefined,
      };

      const res = await searchFacilities(params);
      if (res?.status === 200) {
        const list =
          Array.isArray(res.facilities) ? res.facilities :
          Array.isArray(res.data) ? res.data :
          Array.isArray(res?.data?.facilities) ? res.data.facilities : [];
        setFacilities(list);
      } else {
        setFacilities([]);
      }
    } catch (err) {
      console.error('Filter application failed:', err);
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  };

  const isDetailViewOrAddOns =
    (location.pathname.includes('/dormitories/') && location.pathname.split('/').length > 3) ||
    (location.pathname.includes('/cottages/') && location.pathname.split('/').length > 3) ||
    (location.pathname.includes('/conference/') && location.pathname.split('/').length > 3) ||
    location.pathname.includes('/add-ons/');

  return (
    <div className={styles.mainServicesPageContainer}>
      <HeaderHome />

      <main className={styles.mainContent}>
        <MainServicesHeader />
        <div className={styles.contentWrapper}>
          <MainServicesNavSearch
            onSearch={handleSearch}
            onClearSearch={handleClearSearch}
            onApplyFilters={handleApplyFilters}
          />

          <Routes>
            <Route index element={<Navigate to="dormitories" replace />} />
            <Route
              path="dormitories"
              element={<MainServicesDormitories facilities={facilities} loading={loading} searchAttempted={searchAttempted} />}
            />
            <Route
              path="cottages"
              element={<MainServicesCottages facilities={facilities} loading={loading} searchAttempted={searchAttempted} />}
            />
            <Route
              path="conference"
              element={<MainServicesConference facilities={facilities} loading={loading} searchAttempted={searchAttempted} />}
            />
            <Route
              path="add-ons"
              element={<MainServicesAddOns facilities={facilities} loading={loading} searchAttempted={searchAttempted} />}
            />
            <Route path=":type/:facilityName/:id" element={<MainServicesServiceDetail />} />
          </Routes>

          {!isDetailViewOrAddOns && <MainServicesRates />}
        </div>
      </main>

      <FooterHome />
    </div>
  );
}

export default Services;
