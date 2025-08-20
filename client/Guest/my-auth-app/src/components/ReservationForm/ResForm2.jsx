import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import styles from './ResForm2.module.css';
import { ArrowLeft } from 'lucide-react';
import ErrorBanner from '../ErrorBanner/ErrorBanner';

function ReservationFormStep2() {
  const navigate = useNavigate();
  const location = useLocation();
  const step1 = location.state?.step1 || {};
  const file = location.state?.file || null;
  const { type, facility } = location.state || {};

  useEffect(() => {
       if (!type || !facility) {
         navigate('/services', { replace: true });
       }
     }, [type, facility, navigate]);
  
     if (!type || !facility) return null;

  const [formData, setFormData] = useState({
    dateArrival: '',
    dateDeparture: '',
    typeFacilities: '',
    facilityName: '',
    typeService: '',
    timeArrivalHour: '',
    timeArrivalAMPM: 'AM',
    customService: '',
    specialRequests: '',
  });

  const [facilityOptions, setFacilityOptions] = useState([]);
  const [specialOptions, setSpecialOptions] = useState([]);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [loadingSpecials, setLoadingSpecials] = useState(false);
  const [err, setErr] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [availReason, setAvailReason] = useState('');
  const abortRef = useRef(null);

  // Hydrate from navigation state, then fall back to sessionStorage
  useEffect(() => {
    let hydrated = false;
    if (location.state?.step2) {
      setFormData(prev => ({ ...prev, ...location.state.step2 }));
      hydrated = true;
    }
    if (location.state?.errorsStep2) setFieldErrors(location.state.errorsStep2);
    if (!hydrated) {
      try {
        const saved = sessionStorage.getItem('reservation.step2');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            setFormData(prev => ({ ...prev, ...parsed }));
          }
        }
      } catch {}
    }
  }, [location.state]);

  // Persist to sessionStorage on changes
  useEffect(() => {
    try {
      sessionStorage.setItem('reservation.step2', JSON.stringify(formData));
    } catch {}
  }, [formData]);

  const minArrival = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const handleGoBack = () => {
    navigate('/reservation-form', { state: { step1, step2: formData, type, facility, file } });
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingSpecials(true);
        const res = await fetch(`/api/special-service/get-all-special-services`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load special services');
        if (!active) return;
        const arr = json?.specialServices ?? json?.data ?? json?.services ?? [];
        const opts = arr.map((s, idx) => ({
          value: String(s._id || s.id || `svc-${idx}`),
          label: s.name || s.title || s.displayName || 'Service',
        }));
        setSpecialOptions(opts);
      } catch (e) {
        if (active) setErr({ message: e.message });
      } finally {
        if (active) setLoadingSpecials(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setFacilityOptions([]);
      setErr(null);
      if (!formData.typeFacilities) return;
      try {
        setLoadingFacilities(true);
        const res = await fetch(
          `/api/facility/get-facilities-by-type/${encodeURIComponent(formData.typeFacilities)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load facilities');
        if (!active) return;

        const list = (json?.data || json?.facilities || json || []).map((f, idx) => ({
          _id: String(f._id || f.id),
          label: f.name,
          capacity: f.capacity,
          ratePerPerson: f.ratePerPerson ?? f.price,
          status: f.status ?? 'AVAILABLE',
          __k: String(f._id || f.id || `f-${idx}`),
        }));
        setFacilityOptions(list);
        setFormData(prev => {
          if (!prev.facilityName) return prev;
          const stillExists = list.some(o => o._id === String(prev.facilityName));
          return stillExists ? prev : { ...prev, facilityName: '' };
        });
      } catch (e) {
        if (active) setErr({ message: e.message });
      } finally {
        if (active) setLoadingFacilities(false);
      }
    })();

    setIsAvailable(null);
    setAvailReason('');
    return () => {
      active = false;
    };
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

  function validateStep2Local() {
    const e = {};
    if (!formData.dateArrival) e.dateArrival = 'Required';
    if (!formData.dateDeparture) e.dateDeparture = 'Required';
    if (formData.dateArrival && formData.dateDeparture && formData.dateDeparture < formData.dateArrival) {
      e.dateDeparture = 'Departure must be after arrival.';
    }
    if (!formData.typeFacilities) e.typeFacilities = 'Select a facility type.';
    if (!formData.facilityName) e.facilityName = 'Select a facility.';
    if (!formData.typeService) e.typeService = 'Select a service type.';
    if (!formData.timeArrivalHour) e.timeArrivalHour = 'Enter arrival hour.';
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  async function fetchAvailability({ facilityId, start, end }) {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setCheckingAvail(true);
    setAvailReason('');
    try {
      const qs = new URLSearchParams({ facility: facilityId, start, end });
      const url = `/api/reservation/check-availability?${qs.toString()}`;

      const res = await fetch(url, { method: 'GET', signal: ctrl.signal });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setIsAvailable(false);
        setAvailReason(json.error || `HTTP ${res.status}`);
        return;
      }

      const available = Boolean(json.available);
      setIsAvailable(available);
      setAvailReason(available ? '' : json.reason || 'Facility is not available for the selected dates.');
    } catch (e) {
      if (e.name === 'AbortError') return;
      setIsAvailable(false);
      setAvailReason(e.message || 'Unable to verify availability.');
    } finally {
      setCheckingAvail(false);
    }
  }

  useEffect(() => {
    const { facilityName, dateArrival, dateDeparture } = formData;
    if (!facilityName || facilityName === 'undefined' || facilityName === 'null') return;
    if (!dateArrival || !dateDeparture) return;
    if (dateDeparture < dateArrival) return;

    const t = setTimeout(() => {
      fetchAvailability({
        facilityId: facilityName,
        start: dateArrival,
        end: dateDeparture,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [formData.facilityName, formData.dateArrival, formData.dateDeparture]);

  const handlePrevious = () => {
    navigate('/reservation-form', { state: { step1, step2: formData, type, facility, file } });
  };

  const handleNext = () => {
    if (!validateStep2Local()) return;

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

    const chosenFacility = facilityOptions.find(o => o._id === formData.facilityName);
    if (!chosenFacility) {
      setFieldErrors(prev => ({ ...prev, facilityName: 'Please select a valid facility.' }));
      return;
    }

    const step2 = {
      ...formData,
      facilityIdFromList: chosenFacility._id,
      facilityLabelFromList: chosenFacility.label,
      facilityCapacity: chosenFacility.capacity,
      facilityRatePerPerson: chosenFacility.ratePerPerson,
    };

    navigate('/reservation-step3', {
      state: { step1, step2, type, facility, id: facility, file },
    });
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

          <div className={styles.formCard}>
            <ErrorBanner err={err} onClose={() => setErr(null)} />

            <form onSubmit={e => e.preventDefault()}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Date of Arrival</label>
                  <input
                    type="date"
                    name="dateArrival"
                    min={minArrival}
                    value={formData.dateArrival}
                    onChange={handleInputChange}
                    className={`${styles.input} ${fieldErrors.dateArrival ? styles.inputError : ''}`}
                  />
                  {fieldErrors.dateArrival && (
                    <div className={styles.fieldError}>{fieldErrors.dateArrival}</div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Date of Departure</label>
                  <input
                    type="date"
                    name="dateDeparture"
                    min={formData.dateArrival || minArrival}
                    value={formData.dateDeparture}
                    onChange={handleInputChange}
                    className={`${styles.input} ${fieldErrors.dateDeparture ? styles.inputError : ''}`}
                  />
                  {fieldErrors.dateDeparture && (
                    <div className={styles.fieldError}>{fieldErrors.dateDeparture}</div>
                  )}
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Type of Facilities</label>
                  <select
                    name="typeFacilities"
                    value={formData.typeFacilities}
                    onChange={e => {
                      handleInputChange(e);
                      setFormData(prev => ({ ...prev, facilityName: '' }));
                      setIsAvailable(null);
                      setAvailReason('');
                    }}
                    className={`${styles.input} ${fieldErrors.typeFacilities ? styles.inputError : ''}`}
                  >
                    <option value="">Select a facility type</option>
                    <option value="DORMITORY">Dormitory</option>
                    <option value="CONFERENCE">Conference Hall</option>
                    <option value="COTTAGE">Cottage/Guest House</option>
                  </select>
                  {fieldErrors.typeFacilities && (
                    <div className={styles.fieldError}>{fieldErrors.typeFacilities}</div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Facility Name</label>
                  <select
                    name="facilityName"
                    value={formData.facilityName}
                    onChange={handleInputChange}
                    className={`${styles.input} ${fieldErrors.facilityName ? styles.inputError : ''}`}
                    disabled={!formData.typeFacilities || loadingFacilities}
                  >
                    <option value="">
                      {loadingFacilities ? 'Loading facilities…' : 'Select a facility'}
                    </option>
                    {facilityOptions.map(f => (
                      <option key={f.__k} value={f._id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.facilityName && (
                    <div className={styles.fieldError}>{fieldErrors.facilityName}</div>
                  )}

                  {formData.facilityName && formData.dateArrival && formData.dateDeparture && (
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
                  <label className={styles.label}>Type of Service</label>
                  <select
                    name="typeService"
                    value={formData.typeService}
                    onChange={handleInputChange}
                    className={`${styles.input} ${fieldErrors.typeService ? styles.inputError : ''}`}
                  >
                    <option value="">Select a service type</option>
                    <option value="Meeting/Conference">Meeting/Conference</option>
                    <option value="Wedding">Wedding</option>
                    <option value="Birthday Party">Birthday Party</option>
                    <option value="Corporate Event">Corporate Event</option>
                    <option value="Training/Seminar">Training/Seminar</option>
                    <option value="Accommodation">Accommodation</option>
                    <option value="Other">Other</option>
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
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Time of Arrival</label>
                  <div className={styles.timeInput}>
                    <input
                      type="number"
                      name="timeArrivalHour"
                      value={formData.timeArrivalHour}
                      onChange={handleInputChange}
                      className={`${styles.timeInputBox} ${fieldErrors.timeArrivalHour ? styles.inputError : ''}`}
                      placeholder="HH"
                      min="1"
                      max="12"
                    />
                    <select
                      name="timeArrivalAMPM"
                      value={formData.timeArrivalAMPM}
                      onChange={handleInputChange}
                      className={styles.ampmSelect}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                  {fieldErrors.timeArrivalHour && (
                    <div className={styles.fieldError}>{fieldErrors.timeArrivalHour}</div>
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
                      {loadingSpecials ? 'Loading options…' : 'Select a special service'}
                    </option>
                    {specialOptions.map(request => (
                      <option key={request.value} value={request.value}>
                        {request.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={styles.addRequestButton}>
                    +
                  </button>
                </div>
              </div>

              <div className={styles.buttonContainer}>
                <button type="button" onClick={handlePrevious} className={styles.previousButton}>
                  Previous
                </button>
                <button
                  type="submit"
                  onClick={handleNext}
                  className={styles.nextButton}
                  disabled={checkingAvail}
                  title={checkingAvail ? 'Checking availability…' : undefined}
                >
                  Next
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default ReservationFormStep2;
