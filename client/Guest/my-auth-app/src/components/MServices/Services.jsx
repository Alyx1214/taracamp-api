import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import AllServices from '../MainServices/AllServices';
import Controls from '../MainServices/Controls';
import PopupServices from '../MainServices/PopupServices';

const toISO = (d) => {
  if (!d) return undefined;
  const x = new Date(d);
  if (Number.isNaN(x)) return undefined;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

function Services() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [loadError, setLoadError] = useState(null);   // ✅ you were passing this but never defined it
  
  // Shared filter state for synchronization between Controls and PopupServices
  const [sharedFilters, setSharedFilters] = useState({
    checkInDate: new Date(),
    checkOutDate: (() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    })(),
    adults: 1,
    children: 0,
    serviceType: 'Dormitory'
  });

  const navigate = useNavigate();
  const location = useLocation();

  const getFacilityTypeFromPath = (pathname) => {
    if (pathname.includes('/add-ons')) return 'Add-Ons';
    if (pathname.includes('/dormitories')) return 'Dormitory';
    if (pathname.includes('/cottages')) return 'Cottage';
    if (pathname.includes('/conference')) return 'Conference';
    if (pathname.includes('/all')) return 'All';
    if (pathname.includes('/other-service')) return 'Other Service';
    return '';
  };

  const facilityType = useMemo(
    () => getFacilityTypeFromPath(location.pathname),
    [location.pathname]
  );

  const facilityLabelToEnum = useMemo(
    () => ({
      Dormitory: 'Dormitory',
      Cottage: 'Cottage',
      Conference: 'Conference',
      All: null,
      'Add-Ons': null,
    }),
    []
  );

  const isDetailViewOrAddOns = useMemo(
    () =>
      (location.pathname.includes('/all/') && location.pathname.split('/').length > 3) ||
      (location.pathname.includes('/dormitories/') && location.pathname.split('/').length > 3) ||
      (location.pathname.includes('/cottages/') && location.pathname.split('/').length > 3) ||
      (location.pathname.includes('/conference/') && location.pathname.split('/').length > 3) ||
      location.pathname.includes('/add-ons/'),
    [location.pathname]
  );

  const hasShownPopupRef = useRef(false);

  useEffect(() => {
    const isAddOnsTab = facilityType === 'Add-Ons';

    if (isDetailViewOrAddOns || isAddOnsTab) {
      if (showPopup) setShowPopup(false);
      return;
    }

    if (!hasShownPopupRef.current) {
      if (facilityType && facilityType !== 'Add-Ons') {
        setShowPopup(true);
        hasShownPopupRef.current = true;
      }
      return;
    }

    if (facilityType && facilityType !== 'All' && showPopup) {
      setShowPopup(false);
    }
  }, [facilityType, isDetailViewOrAddOns, showPopup]);

  const handleSearch = async (query) => {
    if (!query?.trim() || (!facilityType && facilityType !== 'All')) return;
    setLoading(true);
    setSearchAttempted(true);
    setLoadError(null);

    try {
      const resolvedType = facilityLabelToEnum[facilityType] ?? null;
      const res = await searchFacilities({ type: resolvedType, query });

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
      setLoadError(err?.data?.error || err?.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setFacilities([]);
    setSearchAttempted(false);
    setLoadError(null);
  };

  const handleApplyFilters = useCallback(async (filters = {}) => {
    setLoading(true);
    setSearchAttempted(true);
    setLoadError(null);

    try {
      const resolvedType =
        filters.type !== undefined ? filters.type : facilityLabelToEnum[facilityType] ?? null;

      const params = {
        type: resolvedType,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        capacity: filters.capacity || undefined,
        checkInDate: toISO(filters.checkInDate),
        checkOutDate: toISO(filters.checkOutDate),
        query: filters.query,
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
      setLoadError(err?.data?.error || err?.message || 'Filter failed.');
    } finally {
      setLoading(false);
    }
  }, [facilityLabelToEnum, facilityType]);

  // Function to update shared filters
  const updateSharedFilters = useCallback((newFilters) => {
    setSharedFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  const handlePopupSubmit = (form) => {
    const mapType = {
      Dormitory: 'Dormitory',
      Cottage: 'Cottage',
      Conference: 'Conference',
    };
    const enumType = mapType[form.serviceType] || null;

    // Update shared filters with popup data
    updateSharedFilters({
      checkInDate: new Date(form.checkIn),
      checkOutDate: new Date(form.checkOut),
      adults: form.adults,
      children: form.children,
      serviceType: form.serviceType
    });

    if (enumType === 'Dormitory') navigate('/user/services/dormitories');
    else if (enumType === 'Cottage') navigate('/user/services/cottages');
    else if (enumType === 'Conference') navigate('/user/services/conference');
    else navigate('/user/services/all');

    handleApplyFilters({
      type: enumType,
      checkInDate: form.checkIn,
      checkOutDate: form.checkOut,
      capacity: form.adults + form.children,
      query: '',
    });
  };

  const shouldShowControls = !isDetailViewOrAddOns;

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

          {/* Optional UX: show top-level error */}
          {loadError && (
            <div style={{ margin: '8px 0', color: 'crimson', fontSize: '0.95rem' }}>
              {loadError}
            </div>
          )}

          {shouldShowControls && (
            <Controls
              facilityType={facilityType || 'All'}
              onApplyFilters={handleApplyFilters}
              sharedFilters={sharedFilters}
              updateSharedFilters={updateSharedFilters}
            />
          )}

          <Routes>
            <Route path="*" element={<Navigate to="all" replace />} />
            <Route
              path="all"
              element={
                <AllServices
                  facilities={facilities}
                  loading={loading}
                  searchAttempted={searchAttempted}
                  loadError={loadError}
                />
              }
            />
            <Route index element={<Navigate to="all" replace />} />
            <Route
              path="dormitories"
              element={
                <MainServicesDormitories
                  facilities={facilities}
                  loading={loading}
                  searchAttempted={searchAttempted}
                  loadError={loadError}   
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
                  loadError={loadError}
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
                  loadError={loadError}
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
            <Route path=":type/:facilityName/:id" element={<MainServicesServiceDetail />} />
          </Routes>

          {!isDetailViewOrAddOns && <MainServicesRates />}
          <PopupServices
            isOpen={showPopup}
            onClose={() => setShowPopup(false)}
            onSubmit={handlePopupSubmit}
            sharedFilters={sharedFilters}
            updateSharedFilters={updateSharedFilters}
          />
        </div>
      </main>

      <FooterHome />
    </div>
  );
}

export default Services;
