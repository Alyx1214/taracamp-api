import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './ResForm2.module.css';
import { ArrowLeft } from 'lucide-react';
import ErrorBanner from '../ErrorBanner/ErrorBanner';
import { searchFacilities } from '../../apis/facilityApi';
import { checkAvailability as apiCheckAvailability } from '../../apis/reservationApi';
import { getAllAddons } from '../../apis/addonsApi';

function ReservationFormStep2() {
  const navigate = useNavigate();
  const location = useLocation();

  const step1 = location.state?.step1 || {};
  const file = location.state?.file || null;
  const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
  const pwdIdFiles = location.state?.pwdIdFiles || [];
  const reservationId = location.state?.reservationId || null;
  const isEdit = location.state?.isEdit || false;
  const userEmail = location.state?.userEmail || null;

  useEffect(() => {
    if (!location.state?.step1 || !Object.keys(location.state.step1).length) {
      navigate(`/reservation-form`, { replace: true });
    }
  }, [location.state, navigate]);



  const [formData, setFormData] = useState({
    dateArrival: '',
    dateDeparture: '',
    typeFacilities: '',
    facilityName: '',
    typeService: '',
    timeArrivalHour: '2',
    timeArrivalAMPM: 'PM',
    specialRequests: '',
  });

  const [facilityOptions, setFacilityOptions] = useState([]);
  const [specialOptions, setSpecialOptions] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [loadingSpecials, setLoadingSpecials] = useState(false);
  const [err, setErr] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [availReason, setAvailReason] = useState('');
  const availReqId = useRef(0);
  const totalGuests = useMemo(() => {
    const a = parseInt(step1?.guests?.adult || 0, 10) || 0;
    const c = parseInt(step1?.guests?.children || 0, 10) || 0;
    const p = parseInt(step1?.guests?.pwds || 0, 10) || 0;
    const s = parseInt(step1?.guests?.senior || 0, 10) || 0;
    return a + c + p + s;
  }, [step1]);

  useEffect(() => {
    let hydrated = false;
    if (location.state?.step2) {
      setFormData(prev => ({ ...prev, ...location.state.step2, typeFacilities: prev.typeFacilities || location.state.step2.typeFacilities || ''}));
      if (location.state.step2.selectedAddons) {
        setSelectedAddons(location.state.step2.selectedAddons);
      }
      // If editing and original facility exists, add it to options immediately
      if (isEdit && location.state.step2.facilityName && location.state.step2.facilityLabelFromList) {
        const originalFacilityId = String(location.state.step2.facilityName);
        setFacilityOptions(prev => {
          const exists = prev.some(o => o._id === originalFacilityId);
          if (!exists) {
            const capacity = Number(location.state.step2.facilityCapacity) || 0;
            const ratePerPerson = Number(location.state.step2.facilityRatePerPerson) || 0;
            return [{
              _id: originalFacilityId,
              label: location.state.step2.facilityLabelFromList,
              capacity: capacity,
              ratePerPerson: ratePerPerson,
              status: 'AVAILABLE',
              __k: originalFacilityId,
            }, ...prev];
          }
          return prev;
        });
      }
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
            if (parsed.selectedAddons) {
              setSelectedAddons(parsed.selectedAddons);
            }
          }
        }
      } catch {}
    }
  }, [location.state]);

  // Add original facility to options list immediately when editing
  useEffect(() => {
    if (isEdit && formData.facilityName && formData.facilityLabelFromList) {
      const originalFacilityId = String(formData.facilityName);
      const capacity = Number(formData.facilityCapacity) || 0;
      const ratePerPerson = Number(formData.facilityRatePerPerson) || 0;
      
      setFacilityOptions(prev => {
        const existingIndex = prev.findIndex(o => o._id === originalFacilityId);
        
        if (existingIndex >= 0) {
          // Update existing facility with correct capacity from formData
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            capacity: capacity > 0 ? capacity : updated[existingIndex].capacity,
            ratePerPerson: ratePerPerson > 0 ? ratePerPerson : updated[existingIndex].ratePerPerson,
          };
          return updated;
        } else {
          // Add original facility if not in list
          return [{
            _id: originalFacilityId,
            label: formData.facilityLabelFromList,
            capacity: capacity,
            ratePerPerson: ratePerPerson,
            status: 'AVAILABLE',
            __k: originalFacilityId,
          }, ...prev];
        }
      });
    }
  }, [isEdit, formData.facilityName, formData.facilityLabelFromList, formData.facilityCapacity, formData.facilityRatePerPerson]);

  useEffect(() => {
    try {
      sessionStorage.setItem('reservation.step2', JSON.stringify({ ...formData, selectedAddons }));
    } catch {}
  }, [formData, selectedAddons]);

  // Calculate these values early so they can be used in useEffect hooks
  const isDormitory = formData.typeFacilities?.toLowerCase().includes('dormitory');
  const isIndividual = step1?.type?.individual || false;

  // Clear includeFood and remove corkage fee if question should be hidden (dormitory or individual)
  useEffect(() => {
    if (isDormitory || isIndividual) {
      if (formData.includeFood) {
        setFormData(prev => ({ ...prev, includeFood: '' }));
      }
      // Remove corkage fee if it exists
      if (specialOptions.length > 0) {
        const corkageFeeAddon = specialOptions.find(opt => 
          opt.label && opt.label.toLowerCase().includes('corkage')
        );
        if (corkageFeeAddon) {
          setSelectedAddons(prev => prev.filter(addon => addon.value !== corkageFeeAddon.value));
        }
      }
    }
  }, [isDormitory, isIndividual, specialOptions]);

  // Auto-add corkage fee when includeFood is "no" and specialOptions are loaded
  useEffect(() => {
    if (!isDormitory && !isIndividual && formData.includeFood === 'no' && specialOptions.length > 0) {
      const corkageFeeAddon = specialOptions.find(opt => 
        opt.label && opt.label.toLowerCase().includes('corkage')
      );
      
      if (corkageFeeAddon) {
        setSelectedAddons(prev => {
          const exists = prev.some(addon => addon.value === corkageFeeAddon.value);
          if (!exists) {
            return [...prev, corkageFeeAddon];
          }
          return prev;
        });
      }
    }
  }, [formData.includeFood, specialOptions, isDormitory, isIndividual]);

  // Ensure corkage fee remains when includeFood is "no" (safeguard against manual removal)
  useEffect(() => {
    if (!isDormitory && !isIndividual && formData.includeFood === 'no' && specialOptions.length > 0) {
      const corkageFeeAddon = specialOptions.find(opt => 
        opt.label && opt.label.toLowerCase().includes('corkage')
      );
      
      if (corkageFeeAddon) {
        setSelectedAddons(prev => {
          const exists = prev.some(addon => addon.value === corkageFeeAddon.value);
          if (!exists) {
            return [...prev, corkageFeeAddon];
          }
          return prev;
        });
      }
    }
  }, [selectedAddons, formData.includeFood, specialOptions, isDormitory, isIndividual]);

  // Get user role from localStorage
  const userRole = useMemo(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userRole') || '';
    }
    return '';
  }, []);

  // Allow frontdesk and superintendent to select today's date, others must select tomorrow or later
  const minArrival = useMemo(() => {
    const isFrontdeskOrSuperintendent = userRole === 'FRONTDESK' || userRole === 'SUPERINTENDENT';
    
    // Get today's date in local timezone (YYYY-MM-DD format)
    const getLocalDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    if (isFrontdeskOrSuperintendent) {
      // Allow today's date
      return getLocalDateString(new Date());
    } else {
      // Others must select tomorrow or later
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return getLocalDateString(d);
    }
  }, [userRole]);

  const handleGoBack = () => {
    navigate(`/reservation-form`, { state: { step1, step2: formData, file, seniorCitizenIdFiles, pwdIdFiles, reservationId, isEdit, userEmail } });
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
      
      // Build search parameters
      const searchParams = { type: formData.typeFacilities };
      
      // Include date filters if both dates are provided and valid
      if (formData.dateArrival && formData.dateDeparture && formData.dateDeparture >= formData.dateArrival) {
        searchParams.checkInDate = formData.dateArrival;
        searchParams.checkOutDate = formData.dateDeparture;
      }
      
      try {
        setLoadingFacilities(true);
        const json = await searchFacilities(searchParams);
        if (!active) return;

        const source = (json?.facilities || json?.data || json || []);
        const filtered = source.filter(f => String(f?.status || '').toUpperCase() === 'AVAILABLE');
        const list = filtered.map((f, idx) => {
          const rawName = String(f.name || '');
          const label = rawName.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
          return {
            _id: String(f._id || f.id),
            label,
            capacity: Number(f.capacity ?? 0),
            ratePerPerson: f.ratePerPerson ?? f.price,
            status: f.status ?? 'AVAILABLE',
            __k: String(f._id || f.id || `f-${idx}`),
          };
        });
        
        // In edit mode, if the original facility exists, ensure it has correct capacity
        if (isEdit && formData.facilityName && formData.facilityLabelFromList) {
          const originalFacilityId = String(formData.facilityName);
          const existingIndex = list.findIndex(o => o._id === originalFacilityId);
          const capacity = Number(formData.facilityCapacity) || 0;
          const ratePerPerson = Number(formData.facilityRatePerPerson) || 0;
          
          if (existingIndex >= 0) {
            // Update existing facility with correct capacity from formData
            list[existingIndex] = {
              ...list[existingIndex],
              capacity: capacity > 0 ? capacity : list[existingIndex].capacity,
              ratePerPerson: ratePerPerson > 0 ? ratePerPerson : list[existingIndex].ratePerPerson,
            };
          } else {
            // Add original facility if not in list
            list.unshift({
              _id: originalFacilityId,
              label: formData.facilityLabelFromList,
              capacity: capacity,
              ratePerPerson: ratePerPerson,
              status: 'AVAILABLE',
              __k: originalFacilityId,
            });
          }
        }
        
        setFacilityOptions(list);

        setFormData(prev => {
          if (prev.facilityName) {
              const stillExists = list.some(o => o._id === String(prev.facilityName));
              // In edit mode, preserve the original facility even if not in current list
              if (!stillExists && isEdit && prev.facilityLabelFromList) {
                return prev; // Keep the original facility selection
              }
              return stillExists ? prev : { ...prev, facilityName: '' };
          }
          return prev;
        });
      } catch (e) {
        if (active) setErr({ message: e.message || 'Failed to load facilities' });
      } finally {
        if (active) setLoadingFacilities(false);
      }
    })();

    setIsAvailable(null);
    setAvailReason('');
    return () => { active = false; };
  }, [formData.typeFacilities, formData.dateArrival, formData.dateDeparture]);

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

    // Handle typeFacilities change - if Conference is selected and user is Individual, navigate back to change type
    if (name === 'typeFacilities') {
      const isConference = value.toLowerCase().includes('conference');
      const isIndiv = step1?.type?.individual || false;
      
      if (isConference && isIndiv) {
        // Navigate back to step 1 with a message to change type to Groups
        setErr({ 
          message: 'Conference facilities are only available for group bookings. Please go back and change your reservation type to "Groups".' 
        });
        // Don't update the value, keep it empty or previous value
        return;
      }
      
      setFormData(prev => ({ ...prev, [name]: value }));
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
      return;
    }

    // Handle includeFood change - automatically add/remove corkage fee
    // Only process if question is visible (not dormitory and not individual)
    if (name === 'includeFood') {
      const isDorm = formData.typeFacilities?.toLowerCase().includes('dormitory');
      const isIndiv = step1?.type?.individual || false;
      
      // Only process if question is visible (not dormitory and not individual)
      if (!isDorm && !isIndiv) {
        setFormData(prev => ({ ...prev, [name]: value }));
        setFieldErrors(prev => ({ ...prev, [name]: undefined }));
        
        // Find corkage fee addon (case-insensitive search)
        const corkageFeeAddon = specialOptions.find(opt => 
          opt.label && opt.label.toLowerCase().includes('corkage')
        );
        
        if (value === 'no' && corkageFeeAddon) {
          // Add corkage fee if not already in selectedAddons
          setSelectedAddons(prev => {
            const exists = prev.some(addon => addon.value === corkageFeeAddon.value);
            if (!exists) {
              return [...prev, corkageFeeAddon];
            }
            return prev;
          });
        } else if (value === 'yes' && corkageFeeAddon) {
          // Remove corkage fee if it exists in selectedAddons
          setSelectedAddons(prev => prev.filter(addon => addon.value !== corkageFeeAddon.value));
        }
      }
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

  const chosenFacility = facilityOptions.find(o => o._id === formData.facilityName);
  // When editing, use capacity from formData if available, otherwise use from chosenFacility
  const facilityCapacity = isEdit && formData.facilityCapacity > 0 
    ? Number(formData.facilityCapacity) 
    : (chosenFacility ? Number(chosenFacility.capacity) : 0);
  const capacityOk = !chosenFacility || facilityCapacity >= totalGuests;
  const capacityMsg =
    chosenFacility && !capacityOk
      ? `Selected facility capacity is ${facilityCapacity}, but you have ${totalGuests} guests.`
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
        const params = {
          facility: facilityName,
          start: dateArrival,
          end: dateDeparture,
        };
        // Exclude current reservation when editing
        if (isEdit && reservationId) {
          params.excludeReservationId = reservationId;
        }
        const json = await apiCheckAvailability(params);

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
  }, [formData.facilityName, formData.dateArrival, formData.dateDeparture, totalGuests, chosenFacility?.capacity, capacityOk, isEdit, reservationId]);

  // Restrict individuals from selecting Conference facility type
  useEffect(() => {
    if (isIndividual && formData.typeFacilities === 'Conference') {
      setFormData(prev => ({ ...prev, typeFacilities: '', facilityName: '' }));
      setFacilityOptions([]);
    }
  }, [isIndividual, formData.typeFacilities]);

  // Restrict individuals to only "Lodging" service type
  useEffect(() => {
    if (isIndividual) {
      // If individual has selected Event or Event and Lodging, reset to Lodging
      if (formData.typeService === 'Event' || formData.typeService === 'Event and Lodging') {
        setFormData(prev => ({ ...prev, typeService: 'Lodging' }));
      } else if (!formData.typeService) {
        // Auto-set to Lodging if no service type is selected
        setFormData(prev => ({ ...prev, typeService: 'Lodging' }));
      }
    }
  }, [isIndividual, formData.typeService]);

  const handlePrevious = () => {
    navigate(`/reservation-form`, { state: { step1, step2: formData, file, seniorCitizenIdFiles, pwdIdFiles, reservationId, isEdit, userEmail } });
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

    let chosen = facilityOptions.find(o => o._id === formData.facilityName);
    
    // When editing, use facility data from formData if facility not found in options
    if (!chosen && isEdit && formData.facilityName && formData.facilityLabelFromList) {
      chosen = {
        _id: formData.facilityName,
        label: formData.facilityLabelFromList,
        capacity: Number(formData.facilityCapacity) || 0,
        ratePerPerson: Number(formData.facilityRatePerPerson) || 0,
      };
    }
    
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

    const isGroup = step1?.type?.groups || false;
    
    // Get current file from location.state to ensure it's up to date
    const currentFile = location.state?.file || file || null;
    
    // Check for seniors and PWDs to determine routing
    const numberOfSeniors = parseInt(step1?.guests?.senior || 0, 10) || 0;
    const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
    const hasSeniors = numberOfSeniors > 0;
    const hasPwds = numberOfPwds > 0;
    
    let nextStep;
    if (isGroup) {
      // Group reservations: go to Letter of Intent first
      nextStep = `/reservation-step3`;
    } else if (hasSeniors) {
      // Individual with seniors: go directly to senior citizen ID upload
      nextStep = `/reservation-step3-senior`;
    } else if (hasPwds) {
      // Individual with PWDs: go directly to PWD ID upload
      nextStep = `/reservation-step3-pwd`;
    } else {
      // Individual without seniors/PWDs: go directly to final step
      nextStep = `/reservation-step4`;
    }
    
    navigate(nextStep, {
      state: { step1, step2, file: currentFile, seniorCitizenIdFiles, pwdIdFiles, reservationId, isEdit, userEmail },
    });
  };

  return (
    <>
      <div className={styles.reservationFormContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.headerSection}>
            <span
              className={styles["add-form-back"]}
              onClick={handleGoBack}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleGoBack()}
            >
              &larr;
            </span>
            <h1 className={styles.title}>RESERVATION FORM</h1>
          </div>

          <div className={styles.mainContent}>
          <div className={styles.formCard}>
            <ErrorBanner err={err} onClose={() => setErr(null)} />

            <form onSubmit={e => e.preventDefault()}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Date of Arrival <span className={styles.required}>*</span></label>
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
                  <label className={styles.label}>Date of Departure <span className={styles.required}>*</span></label>
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
                  <label className={styles.label}>Type of Facility <span className={styles.required}>*</span></label>
                  <select
                    name="typeFacilities"
                    value={formData.typeFacilities}
                    onChange={handleInputChange}
                    className={`${styles.input} ${fieldErrors.typeFacilities ? styles.inputError : ''}`}
                  >
                    <option value="">Select a facility type</option>
                    {!isIndividual && <option value="Conference">Conference</option>}
                    <option value="Dormitory">Dormitory</option>
                    <option value="Cottage">Cottage</option>
                  </select>
                  {isIndividual && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Individuals cannot select Conference facility type.
                    </div>
                  )}
                  {fieldErrors.typeFacilities && (
                    <div className={styles.fieldError}>{fieldErrors.typeFacilities}</div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Facility Name <span className={styles.required}>*</span></label>
                  <select
                    name="facilityName"
                    value={String(formData.facilityName || '')}
                    onChange={handleInputChange}
                    className={`${styles.input} ${fieldErrors.facilityName ? styles.inputError : ''}`}
                    disabled={!formData.typeFacilities || loadingFacilities}
                  >
                    <option value="">{loadingFacilities ? 'Loading facilities…' : 'Select a facility'}</option>
                    {facilityOptions.map(o => {
                      const cap = Number.isFinite(o.capacity) ? o.capacity : 0;
                      const tooSmall = cap < totalGuests;
                      const label = `${o.label} (${cap} pax)`;
                      return (
                        <option key={o.__k} value={String(o._id)} disabled={tooSmall}>{label}</option>
                      );
                    })}
                  </select>
                {fieldErrors.facilityName && (
                  <div className={styles.fieldError}>{fieldErrors.facilityName}</div>
                )}
                  {!fieldErrors.facilityName && chosenFacility && !capacityOk && (
                    <div className={styles.fieldError}>
                      {`Selected facility capacity is ${chosenFacility.capacity}, but you have ${totalGuests} guests.`}
                    </div>
                  )}
                  {formData.facilityName && (
                    <div className={styles.availabilityRow}>
                      {checkingAvail && <span className={styles.availabilityPending}>Checking availability…</span>}
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
                  <label className={styles.label}>Type of Service <span className={styles.required}>*</span></label>
                  <select
                    name="typeService"
                    value={formData.typeService}
                    onChange={handleInputChange}
                    className={`${styles.input} ${fieldErrors.typeService ? styles.inputError : ''}`}
                    disabled={isIndividual}
                  >
                    <option value="">Select a service type</option>
                    {!isIndividual && <option value="Event">Event</option>}
                    {!isIndividual && <option value="Event and Lodging">Event and Lodging</option>}
                    <option value="Lodging">Lodging</option>
                  </select>
                  {isIndividual && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Individuals can only select Lodging service type.
                    </div>
                  )}
                  {fieldErrors.typeService && (
                    <div className={styles.fieldError}>{fieldErrors.typeService}</div>
                  )}

                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Time of Arrival <span className={styles.required}>*</span></label>
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

              {!isDormitory && !isIndividual && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Do you want to avail the food included in your package?
                  </label>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="radio"
                        name="includeFood"
                        value="yes"
                        checked={formData.includeFood === 'yes'}
                        onChange={handleInputChange}
                      />
                      <span>Yes</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="radio"
                        name="includeFood"
                        value="no"
                        checked={formData.includeFood === 'no'}
                        onChange={handleInputChange}
                      />
                      <span>No</span>
                    </label>
                  </div>
                  {fieldErrors.includeFood && (
                    <div className={styles.fieldError}>{fieldErrors.includeFood}</div>
                  )}
                </div>
              )}

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
                      {selectedAddons.map((addon) => {
                        const isCorkageFee = addon.label && addon.label.toLowerCase().includes('corkage');
                        const cannotRemove = isCorkageFee && formData.includeFood === 'no';
                        return (
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
                                if (!cannotRemove) {
                                  setSelectedAddons(prev => prev.filter(item => item.value !== addon.value));
                                }
                              }}
                              disabled={cannotRemove}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: cannotRemove ? '#999' : '#666',
                                cursor: cannotRemove ? 'not-allowed' : 'pointer',
                                fontSize: '16px',
                                lineHeight: '1',
                                padding: '0',
                                marginLeft: '2px',
                                opacity: cannotRemove ? 0.5 : 1
                              }}
                              title={cannotRemove ? 'Corkage fee cannot be removed when food package is not availed' : 'Remove addon'}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
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
                  {chosenFacility?.label || formData.facilityLabelFromList || formData.facilityName || 'Select Facility'}
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
                      {formData.typeService || 'Not selected'}
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
