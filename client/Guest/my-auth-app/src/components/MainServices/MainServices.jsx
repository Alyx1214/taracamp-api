import React, { useState, useEffect} from 'react';
import { useNavigate, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom'; 
import Navbar from '../Header/Header';
import Footer from '../Footer/Footer';
import styles from './MainServices.module.css';
import MainServicesHeader from './Header';
import MainServicesNavSearch from './NavSearch';
import MainServicesDormitories from './Dormitories';
import MainServicesCottages from './Cottages';
import MainServicesRates from './ServicesRates';
import MainServicesConference from './Conference';
import MainServicesOtherService from './OtherService';
import MainServicesServiceDetail from './ServiceDetail';


function MainServices() {
  const [facilities, setFacilities] = useState([]);     
  const [loading, setLoading] = useState(false); 
  const [searchAttempted, setSearchAttempted] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const getFacilityTypeFromPath = (pathname) => {
    if (pathname.includes('/dormitories')) return 'DORMITORY';
    if (pathname.includes('/cottages')) return 'COTTAGE';
    if (pathname.includes('/conference')) return 'CONFERENCE';
    if (pathname.includes('/otherservice')) return 'OTHER SERVICE';
    return '';
  };

  const facilityType = getFacilityTypeFromPath(location.pathname);

  useEffect(() => {
    setFacilities([]);
    setSearchAttempted(false);
  }, [facilityType]);

  const handleSearch = async (query) => {
    if (!query.trim() || !facilityType) return;
    setLoading(true);
    setSearchAttempted(true);

    try {
      let url, key;
      if (facilityType === 'OTHER SERVICE') {
        // Special Services search
        url = `/api/special-service/search-special-services?query=${encodeURIComponent(query)}`;
        key = 'specialServices';
      } else {
        url = `/api/facility/search-facilities?type=${encodeURIComponent(facilityType)}&query=${encodeURIComponent(query)}`;
        key = 'facilities';
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 200) {
        setFacilities(data[key] || []);
      } else {
        setFacilities([]);
      }
    } catch {
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
      let params = new URLSearchParams();
      let url, key;

      if (facilityType === 'OTHER SERVICE') {
        if (filters.minPrice) params.append('minPrice', filters.minPrice);
        if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
        if (filters.query) params.append('query', filters.query);
        if (filters.unit) params.append('unit', filters.unit);
        url = `/api/special-service/search-special-services?${params.toString()}`;
        key = 'specialServices';
      } else {
        params.append('type', facilityType);
        if (filters.minPrice) params.append('minPrice', filters.minPrice);
        if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
        if (filters.capacity) params.append('capacity', filters.capacity);
        if (filters.checkInDate) params.append('checkInDate', filters.checkInDate);
        if (filters.checkOutDate) params.append('checkOutDate', filters.checkOutDate);
        url = `/api/facility/search-facilities?${params.toString()}`;
        key = 'facilities';
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 200) {
        setFacilities(data[key] || []);
      } else {
        setFacilities([]);
      }
    } catch {
      setFacilities([]);
    }
    setLoading(false);
  };


  const handleReserveNow = () => {
    console.log("Reserve Now clicked from MainServices page!");
    navigate('/auth/login');
  };

  const isDetailViewOrOtherService = 
    (location.pathname.includes('/dormitories/') && location.pathname.split('/').length > 3) ||
    (location.pathname.includes('/cottages/') && location.pathname.split('/').length > 3) ||
    (location.pathname.includes('/conference/') && location.pathname.split('/').length > 3) ||
    location.pathname.includes('/otherservice');

  return (
    <div className={styles.mainServicesPageContainer}>
      <Navbar onReserveNow={handleReserveNow} />

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

      <Footer onReserveNow={handleReserveNow} />
    </div>
  );
}

export default MainServices;