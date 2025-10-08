import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import styles from './ResForm2.module.css';
import { ArrowLeft } from 'lucide-react';
import ErrorBanner from '../ErrorBanner/ErrorBanner';

import { searchFacilities } from '../../apis/facilityApi';
import { checkAvailability as apiCheckAvailability } from '../../apis/reservationApi';
import { getAllAddons } from '../../apis/addonsApi';

function ReservationFormStep2() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const step1 = location.state?.step1 || {};
  const file = location.state?.file || null;
  const { type, facilityName, id } = useParams();
  const routeFacilityType = useMemo(() => {
    const t = String(type || '').toLowerCase();
    if (t.startsWith('dormi')) return 'Dormitory';
    if (t.startsWith('cott')) return 'Cottage';
    if (t.startsWith('conf')) return 'Conference';
    return '';
  }, [type]);

  const urlFacilityType = useMemo(() => {
    const facilityType = searchParams.get('facilityType');
    return facilityType || routeFacilityType;
  }, [searchParams, routeFacilityType]);

  useEffect(() => {
    if (!location.state?.step1 || !Object.keys(location.state.step1).length) {
      // If we have URL parameters, use them; otherwise fallback to basic route
      if (type && facilityName && id) {
        navigate(`/reservation-form/${type}/${facilityName}/${id}`, { replace: true });
      } else {
        navigate('/reservation-form', { replace: true });
      }
    }
  }, [location.state, type, facilityName, id, navigate]);



  const [formData, setFormData] = useState({
    dateArrival: '',
    dateDeparture: '',
    typeFacilities: urlFacilityType,
    facilityName: '',
    typeService: '',
    timeArrivalHour: '',
    timeArrivalAMPM: 'AM',
    customService: '',
    specialRequests: '',
    numberOfRooms: 1,
  });

  const [facilityOptions, setFacilityOptions] = useState([]);
  const [specialOptions, setSpecialOptions] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [loadingSpecials, setLoadingSpecials] = useState(false);
  const [err, setErr] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [availReason, setAvailReason] = useState('');
  const [autoSetServiceForDorm, setAutoSetServiceForDorm] = useState(false);
  const availReqId = useRef(0);
  const totalGuests = useMemo(() => {
    const a = parseInt(step1?.guests?.adult || 0, 10) || 0;
    const c = parseInt(step1?.guests?.children || 0, 10) || 0;
    const p = parseInt(step1?.guests?.pwds || 0, 10) || 0;
    return a + c + p;
  }, [step1]);

  useEffect(() => {
    let hydrated = false;
    if (location.state?.step2) {
      setFormData(prev => ({
        ...prev,
        ...location.state.step2,
        typeFacilities: prev.typeFacilities || urlFacilityType || location.state.step2.typeFacilities || ''
      }));
      if (location.state.step2.selectedAddons) {
        setSelectedAddons(location.state.step2.selectedAddons);
      }
      hydrated = true;
    }
    if (location.state?.errorsStep2) setFieldErrors(location.state.errorsStep2);

    // Handle preselected dates from ServiceDetail
    if (location.state?.preselectedDates) {
      const { dateArrival, dateDeparture } = location.state.preselectedDates;
      setFormData(prev => ({
        ...prev,
        dateArrival: dateArrival || prev.dateArrival,
        dateDeparture: dateDeparture || prev.dateDeparture,
        typeFacilities: prev.typeFacilities || urlFacilityType
      }));
      hydrated = true;
    }

    if (!hydrated) {
      try {
        const saved = sessionStorage.getItem('reservation.step2');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            setFormData(prev => ({
              ...prev,
              ...parsed,
              typeFacilities: prev.typeFacilities || urlFacilityType,
              // Ensure preselected dates override sessionStorage
              ...(location.state?.preselectedDates && {
                dateArrival: location.state.preselectedDates.dateArrival || prev.dateArrival,
                dateDeparture: location.state.preselectedDates.dateDeparture || prev.dateDeparture
              })
            }));
            if (parsed.selectedAddons) {
              setSelectedAddons(parsed.selectedAddons);
            }
          }
        }
      } catch {}
    }
  }, [location.state, urlFacilityType]);

  useEffect(() => {
    try {
      sessionStorage.setItem('reservation.step2', JSON.stringify({ ...formData, selectedAddons }));
    } catch {}
  }, [formData, selectedAddons]);


  const handleGoBack = () => {
    navigate(`/reservation-form/${type}/${facilityName}/${id}`, { state: { step1, step2: formData, file } });
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingSpecials(true);
        const json = await getAllAddons();
        if (!active) return;

        const arr = Array.isArray(json.addons) ? json.addons : [];
        const opts = arr.map((s) => ({
          value: String(s._id),
          label: s.name,
        }));
        setSpecialOptions(opts);
      } catch (e) {
        if (active) setErr({ message: e.message || 'Failed to load add ons' });
      } finally {
        if (active) setLoadingSpecials(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setFacilityOptions([]);
      setErr(null);
      if (!formData.typeFacilities) return;
      try {
        const json = await searchFacilities({ type: formData.typeFacilities });
        if (!active) return;

        const src = Array.isArray(json.facilities) ? json.facilities : [];
        const filtered = src.filter(f => String(f?.status || '') === 'Available');
        const list = filtered.map((f) => {
          const rawName = String(f.name || '');
          const label = rawName.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
          return {
            _id: String(f._id || f.id),
            label,
            capacity: Number(f.capacity) || 0,
            ratePerPerson: Number(f.ratePerPerson) || 0,
            price: Number(f.price) || 0,
            image: f.image || null,
            status: f.status || null,
          };
        });
        setFacilityOptions(list);

        setFormData(prev => {
          if (prev.facilityName) {
              const stillExists = list.some(o => o._id === String(prev.facilityName));
              return stillExists ? prev : { ...prev, facilityName: '' };
          }

          const urlMatch = list.find(o => o._id === String(id));
          return urlMatch ? { ...prev, facilityName: urlMatch._id } : prev;

        });
      } catch (e) {
        if (active) setErr({ message: e.message || 'Failed to load facilities' });
      }
    })();

    setIsAvailable(null);
    setAvailReason('');
    return () => { active = false; };
  }, [formData.typeFacilities]);

  const handleInputChange = e => {
    const { name, value } = e.target;

    if (name === 'facilityName') {
      const idStr = typeof value === 'string' ? value.trim() : '';
      const safe = idStr && idStr !== 'undefined' && idStr !== 'null' ? idStr : '';
      setFormData(prev => ({ ...prev, facilityName: safe }));
      setFieldErrors(prev => ({ ...prev, facilityName: undefined }));
      setIsAvailable(null);
      setAvailReason('');
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    setFieldErrors(prev => ({ ...prev, [name]: undefined }));

    if (name === 'dateArrival' || name === 'dateDeparture') {
      setIsAvailable(null);
      setAvailReason('');
    }
  };


  const chosenFacility = facilityOptions.find(o => o._id === formData.facilityName);
  const isDormitory = formData.typeFacilities?.toLowerCase().includes('dormitory');
  const capacityOk = !chosenFacility || Number(chosenFacility.capacity) >= totalGuests;
  const capacityMsg =
    chosenFacility && !capacityOk
      ? `Selected facility capacity is ${chosenFacility.capacity}, but you have ${totalGuests} guests.`
      : '';

  useEffect(() => {
    const { facilityName, dateArrival, dateDeparture } = formData;
    if (!facilityName || facilityName === 'undefined' || facilityName === 'null') return;
    if (!dateArrival || !dateDeparture) return;
    if (dateDeparture < dateArrival) return;

    if (!capacityOk) {
      setIsAvailable(null);
      setAvailReason(capacityMsg);
      return;
    }

    const currentId = ++availReqId.current;

    const t = setTimeout(async () => {
      setCheckingAvail(true);
      setAvailReason('');
      try {
        const json = await apiCheckAvailability({
          facility: facilityName,
          start: dateArrival,
          end: dateDeparture,
        });

        if (availReqId.current !== currentId) return; 
        const available = Boolean(json?.available);
        setIsAvailable(available);
        setAvailReason(available ? '' : json?.reason || 'Facility is not available for the selected dates.');
      } catch (e) {
        if (availReqId.current !== currentId) return;
        setIsAvailable(false);
        setAvailReason(e?.message || 'Unable to verify availability.');
      } finally {
        if (availReqId.current === currentId) setCheckingAvail(false);
      }
    }, 400);

    return () => clearTimeout(t);
  }, [formData.facilityName, formData.dateArrival, formData.dateDeparture, totalGuests, chosenFacility?.capacity, capacityOk]);

  function validateStep2Local() {
    const e = {};
    if (!formData.typeService) e.typeService = 'Select a service type.';
    if (isDormitory && (!formData.numberOfRooms || formData.numberOfRooms < 1)) {
      e.numberOfRooms = 'Number of rooms is required for dormitory reservations.';
    }
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  useEffect(() => {
    if (isDormitory) {
      if (!formData.typeService) {
        setFormData(prev => ({ ...prev, typeService: 'Accommodation' }));
        setAutoSetServiceForDorm(true);
      } else {
        setAutoSetServiceForDorm(false);
      }
      return;
    }

    if (!isDormitory && autoSetServiceForDorm) {
      setFormData(prev => ({ ...prev, typeService: '' }));
      setAutoSetServiceForDorm(false);
    }
  }, [isDormitory]); 

  const handlePrevious = () => {
    navigate(`/reservation-form/${type}/${facilityName}/${id}`, { state: { step1, step2: formData, file } });
  };

  const handleNext = () => {
    if (!validateStep2Local()) return;
    if (!capacityOk) return;

    if (isAvailable === false) {
      setFieldErrors(prev => ({
        ...prev,
        dateArrival: prev.dateArrival || availReason || 'Facility is not available for the selected dates.',
        dateDeparture: prev.dateDeparture || 'Choose different dates.',
        facilityName: prev.facilityName || 'Select another facility or change the date range.',
      }));
      return;
    }
    if (isAvailable === null) {
      setFieldErrors(prev => ({
        ...prev,
        dateArrival: prev.dateArrival || 'Checking availability…',
        dateDeparture: prev.dateDeparture || 'Checking availability…',
        facilityName: prev.facilityName || 'Checking availability…',
      }));
      return;
    }

    const chosen = facilityOptions.find(o => o._id === formData.facilityName);
    if (!chosen) {
      setFieldErrors(prev => ({ ...prev, facilityName: 'Please select a valid facility.' }));
      return;
    }

    const step2 = {
      ...formData,
      facilityIdFromList: chosen._id,
      facilityLabelFromList: chosen.label,
      facilityCapacity: chosen.capacity,
      facilityRatePerPerson: chosen.ratePerPerson,
      selectedAddons: selectedAddons,
    };

    if (step1?.type?.individual) {
      navigate(`/reservation-step4/${type}/${facilityName}/${id}`, {
        state: { step1, step2, file: null },
      });
    } else {
      navigate(`/reservation-step3/${type}/${facilityName}/${id}`, {
        state: { step1, step2, file },
      });
    }
  };

  return (
    <>
      <HeaderHome />
      <div className={styles.reservationFormContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.headerSection}>
            <button onClick={handleGoBack} className={styles.backButton}>
              <ArrowLeft size={24} />
            </button>
            <h1 className={styles.pageTitle}>RESERVATION FORM</h1>
          </div>
          
          <div className={styles.mainContent}>
          <div className={styles.formCard}>
            <ErrorBanner err={err} onClose={() => setErr(null)} />

            <form onSubmit={e => e.preventDefault()}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Date of Arrival</label>
                  <div className={styles.input} style={{ backgroundColor: '#f5f5f5', color: '#333' }}>
                    {formData.dateArrival ? new Date(formData.dateArrival).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    }) : 'Not specified'}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Date of Departure</label>
                  <div className={styles.input} style={{ backgroundColor: '#f5f5f5', color: '#333' }}>
                    {formData.dateDeparture ? new Date(formData.dateDeparture).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    }) : 'Not specified'}
                  </div>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Type of Facilities</label>
                  <div className={styles.input} style={{ backgroundColor: '#f5f5f5', color: '#333' }}>
                    {formData.typeFacilities || 'Not specified'}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Facility Name</label>
                  <div className={styles.input} style={{ backgroundColor: '#f5f5f5', color: '#333' }}>
                    {chosenFacility?.label || 'Not specified'}
                  </div>

                  {formData.facilityName && formData.dateArrival && formData.dateDeparture && capacityOk && (
                    <div className={styles.availabilityRow}>
                      {checkingAvail && (
                        <span className={styles.availabilityPending}>Checking availability…</span>
                      )}
                      {!checkingAvail && isAvailable === true && (
                        <span className={styles.availabilityOk}>Available ✔</span>
                      )}
                      {!checkingAvail && isAvailable === false && (
                        <span className={styles.availabilityBad}>
                          {availReason || 'Not available for the selected dates.'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Type of Service{!isDormitory && <span className={styles.requiredAsterisk}>*</span>}
                  </label>
                  {!isDormitory ? (
                    <>
                      <select
                        name="typeService"
                        value={formData.typeService}
                        onChange={handleInputChange}
                        className={`${styles.input} ${fieldErrors.typeService ? styles.inputError : ''}`}
                      >
                        <option value="">Select a service type</option>
                        <option value="Event">Event</option>
                        <option value="Event and Lodging">Event and Lodging</option>
                        <option value="Lodging">Lodging</option>
                      </select>
                      {fieldErrors.typeService && (
                        <div className={styles.fieldError}>{fieldErrors.typeService}</div>
                      )}

                      {formData.typeService === 'Other' && (
                        <input
                          type="text"
                          name="customService"
                          value={formData.customService || ''}
                          onChange={handleInputChange}
                          placeholder="Please specify..."
                          className={styles.input}
                          style={{ marginTop: 8 }}
                        />
                      )}
                    </>
                  ) : (
                    <div className={styles.input} style={{ backgroundColor: '#f5f5f5', color: '#333' }}>
                      Accommodation
                    </div>
                  )}
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Time of Arrival</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        name="timeArrivalHour"
                        value={formData.timeArrivalHour}
                        onChange={handleInputChange}
                        className={styles.input}
                        style={{ flex: 1 }}
                      >
                        <option value="">Hour</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(hour => (
                          <option key={hour} value={hour.toString().padStart(2, '0')}>
                            {hour.toString().padStart(2, '0')}
                          </option>
                        ))}
                      </select>
                      <select
                        name="timeArrivalAMPM"
                        value={formData.timeArrivalAMPM}
                        onChange={handleInputChange}
                        className={styles.input}
                        style={{ flex: 0, minWidth: '70px' }}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>

                  {isDormitory && (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Number of Rooms<span className={styles.requiredAsterisk}>*</span></label>
                      <div className={styles.quantityInput}>
                        <button
                          type="button"
                          className={styles.quantityButton}
                          onClick={() => {
                            const current = parseInt(formData.numberOfRooms || 1, 10);
                            if (current > 1) {
                              setFormData(prev => ({ ...prev, numberOfRooms: current - 1 }));
                            }
                          }}
                          disabled={parseInt(formData.numberOfRooms || 1, 10) <= 1}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          name="numberOfRooms"
                          value={formData.numberOfRooms || 1}
                          onChange={handleInputChange}
                          className={`${styles.quantityInputBox} ${fieldErrors.numberOfRooms ? styles.inputError : ''}`}
                          min="1"
                          max="10"
                        />
                        <button
                          type="button"
                          className={styles.quantityButton}
                          onClick={() => {
                            const current = parseInt(formData.numberOfRooms || 1, 10);
                            if (current < 10) {
                              setFormData(prev => ({ ...prev, numberOfRooms: current + 1 }));
                            }
                          }}
                          disabled={parseInt(formData.numberOfRooms || 1, 10) >= 10}
                        >
                          +
                        </button>
                      </div>
                      {fieldErrors.numberOfRooms && (
                        <div className={styles.fieldError}>{fieldErrors.numberOfRooms}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Other Special Request or Services</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    name="specialRequests"
                    value={formData.specialRequests}
                    onChange={handleInputChange}
                    className={styles.input}
                    style={{ flex: 1 }}
                  >
                    <option value="">
                      {loadingSpecials ? 'Loading options…' : 'Select add ons'}
                    </option>
                    {specialOptions.map(request => (
                      <option key={request.value} value={request.value}>
                        {request.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.addRequestButton}
                    onClick={() => {
                      if (formData.specialRequests) {
                        const selectedOption = specialOptions.find(opt => opt.value === formData.specialRequests);
                        if (selectedOption && !selectedAddons.some(addon => addon.value === selectedOption.value)) {
                          setSelectedAddons(prev => [...prev, selectedOption]);
                          setFormData(prev => ({ ...prev, specialRequests: '' }));
                        }
                      }
                    }}
                    disabled={!formData.specialRequests || selectedAddons.some(addon => addon.value === formData.specialRequests)}
                  >+</button>
                </div>
                {selectedAddons.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: '14px', marginBottom: 8, color: '#666' }}>Selected Add-ons:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {selectedAddons.map((addon) => (
                        <div
                          key={addon.value}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: '#e8f4fd',
                            border: '1px solid #b3d8f2',
                            borderRadius: '16px',
                            padding: '4px 12px',
                            fontSize: '13px',
                            gap: '6px'
                          }}
                        >
                          <span>{addon.label}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAddons(prev => prev.filter(item => item.value !== addon.value));
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#666',
                              cursor: 'pointer',
                              fontSize: '16px',
                              lineHeight: '1',
                              padding: '0',
                              marginLeft: '2px'
                            }}
                            title="Remove addon"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.buttonContainer}>
                <button type="button" onClick={handlePrevious} className={styles.previousButton}>
                  Previous
                </button>
                <button
                  type="submit"
                  onClick={handleNext}
                  className={styles.nextButton}
                  disabled={checkingAvail || !capacityOk}
                  title={
                    !capacityOk
                      ? (chosenFacility ? `Selected facility capacity is ${chosenFacility.capacity}, but you have ${totalGuests} guests.` : '')
                      : checkingAvail
                      ? 'Checking availability…'
                      : undefined
                  }
                >
                  Next
                </button>
              </div>
            </form>
          </div>

           <div className={styles.summaryContainer}>
              <div className={styles.summaryCard}>
                <h3 className={styles.summaryTitle}>
                  {chosenFacility?.label || formData.facilityName || 'Select Facility'}
                </h3>

                <div className={styles.summaryContent}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Type of Facility:</span>
                    <span className={styles.summaryValue}>
                      {formData.typeFacilities || 'Not selected'}
                    </span>
                  </div>

                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Category:</span>
                    <span className={styles.summaryValue}>
                      {(() => {
                        const categoryKey = Object.entries(step1?.category || {}).find(([, v]) => v)?.[0];
                        if (!categoryKey) return 'Not selected';
                        if (categoryKey === 'deped') return 'DepEd';
                        if (categoryKey === 'pwds') return 'PWDs';
                        return categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
                      })()}
                    </span>
                  </div>

                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Type:</span>
                    <span className={styles.summaryValue}>
                      {Object.entries(step1?.type || {}).find(([, v]) => v)?.[0]?.charAt(0).toUpperCase() + Object.entries(step1?.type || {}).find(([, v]) => v)?.[0]?.slice(1) || 'Not selected'}
                    </span>
                  </div>

                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Total Guest:</span>
                    <span className={styles.summaryValue}>{totalGuests}</span>
                  </div>

                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Date of Arrival:</span>
                    <span className={styles.summaryValue}>
                      {formData.dateArrival ? new Date(formData.dateArrival).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'Not selected'}
                    </span>
                  </div>

                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Date of Departure:</span>
                    <span className={styles.summaryValue}>
                      {formData.dateDeparture ? new Date(formData.dateDeparture).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'Not selected'}
                    </span>
                  </div>

                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Type of Service:</span>
                    <span className={styles.summaryValue}>
                      {formData.typeService === 'Other' ? (formData.customService || 'Other') : (formData.typeService || 'Not selected')}
                    </span>
                  </div>

                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Time of Arrival:</span>
                    <span className={styles.summaryValue}>
                      {formData.timeArrivalHour ? `${formData.timeArrivalHour}:00 ${formData.timeArrivalAMPM}` : 'Not selected'}
                    </span>
                  </div>

                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Add ons:</span>
                    <span className={styles.summaryValue}>
                      {selectedAddons.length > 0 ? selectedAddons.map(addon => addon.label).join(', ') : 'None'}
                    </span>
                  </div>

                  {isDormitory && (
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Number of Rooms:</span>
                      <span className={styles.summaryValue}>
                        {formData.numberOfRooms || 1}
                      </span>
                    </div>
                  )}

                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Emergency Contact Person:</span>
                    <span className={styles.summaryValue}>
                      {step1.emergencyContactPerson || 'Not provided'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
    </>
  );
}

export default ReservationFormStep2;
