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
import MainServicesOtherService from '../MainServices/OtherService';
import MainServicesServiceDetail from '../MainServices/ServiceDetail';


function Services() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const API = import.meta.env.VITE_API_URL; 

  const getFacilityTypeFromPath = (pathname) => {
    if (pathname.includes('/dormitories')) return 'DORMITORY';
    if (pathname.includes('/cottages')) return 'COTTAGE';
    if (pathname.includes('/conference')) return 'CONFERENCE';
    if (pathname.includes('/otherservice')) return 'OTHER SERVICE';
    return '';
  };

  const facilityType = getFacilityTypeFromPath(location.pathname);

  const handleSearch = async (query) => {
    if (!query.trim() || !facilityType) return;
    setLoading(true);
    setSearchAttempted(true);
    try {
      const res = await fetch(
        `${API}/facility/search-facilities?type=${encodeURIComponent(facilityType)}&query=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (data.status === 200) {
        setFacilities(data.facilities || []);
      } else {
        setFacilities([]);
      }
    } catch (error) { 
      console.error("Search failed:", error);
      setFacilities([]);
    }
    setLoading(false);
  };

  const handleClearSearch = () => {
    setFacilities([]);
    setSearchAttempted(false);
  };

  const handleApplyFilters = async (filters) => {
    setLoading(true);
    setSearchAttempted(true);
    try {
      const params = new URLSearchParams({
        type: facilityType,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        capacity: filters.capacity,
        checkInDate: filters.checkInDate,
        checkOutDate: filters.checkOutDate
      });

      for (const [key, value] of params.entries()) {
        if (!value) params.delete(key);
      }

      const res = await fetch(`${API}/facility/search-facilities?${params.toString()}`);
      const data = await res.json();
      if (data.status === 200) {
        setFacilities(data.facilities || []);
      } else {
        setFacilities([]);
      }
    } catch (error) { 
      console.error("Filter application failed:", error);
      setFacilities([]);
    }
    setLoading(false);
  };


  const isDetailViewOrOtherService =
    (location.pathname.includes('/dormitories/') && location.pathname.split('/').length > 3) ||
    (location.pathname.includes('/cottages/') && location.pathname.split('/').length > 3) ||
    (location.pathname.includes('/conference/') && location.pathname.split('/').length > 3) ||
    location.pathname.includes('/otherservice');

  return (
    <div className={styles.mainServicesPageContainer}>
      <HeaderHome /> 

      <main className={styles.mainContent}>
        <MainServicesHeader />
        <div className={styles.contentWrapper}>
          <MainServicesNavSearch onSearch={handleSearch} onClearSearch={handleClearSearch} onApplyFilters={handleApplyFilters} />

         <Routes>
          <Route index element={<Navigate to="dormitories" replace />} />
          <Route path="dormitories" element={<MainServicesDormitories facilities={facilities} loading={loading} searchAttempted={searchAttempted} />} />
          <Route path="cottages" element={<MainServicesCottages facilities={facilities} loading={loading} searchAttempted={searchAttempted} />} />
          <Route path="conference" element={<MainServicesConference facilities={facilities} loading={loading} searchAttempted={searchAttempted} />} />
          <Route path="otherservice" element={<MainServicesOtherService facilities={facilities} loading={loading} searchAttempted={searchAttempted} />} />
          <Route path=":type/:id" element={<MainServicesServiceDetail />} />
        </Routes>

          {!isDetailViewOrOtherService && <MainServicesRates />}
        </div>
      </main>

      <FooterHome /> 
    </div>
  );
}

export default Services;