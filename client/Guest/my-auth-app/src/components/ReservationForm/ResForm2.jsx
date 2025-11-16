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
    timeArrivalHour: '02',
    timeArrivalAMPM: 'PM',
    customService: '',
    specialRequests: '',
  });

  const [facilityOptions, setFacilityOptions] = useState([]);
  const [specialOptions, setSpecialOptions] = useState([]);
  const [allAddons, setAllAddons] = useState([]); // Store all addons with serviceType
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [loadingSpecials, setLoadingSpecials] = useState(false);
  
  // Filter add-ons based on service type and includeFood
  const filteredSpecialOptions = useMemo(() => {
    let filtered = specialOptions;
    
    // Filter by service type if selected
    if (formData.typeService) {
      const selectedServiceType = formData.typeService;
      
      // If "Event and Lodging" is selected, show all add-ons (don't filter by service type)
      if (selectedServiceType !== 'Event and Lodging') {
        filtered = filtered.filter(opt => {
          const addon = allAddons.find(a => String(a._id) === opt.value);
          if (!addon || !addon.serviceType) {
            // If addon has no serviceType, show it for all service types
            return true;
          }
          
          const addonServiceType = addon.serviceType;
          
          // Match logic:
          // - If user selects "Event", show addons with serviceType "Event" or "All"
          // - If user selects "Lodging", show addons with "Lodging" or "All"
          if (addonServiceType === 'All') {
            return true; // "All" type addons appear for all service types
          }
          
          return addonServiceType === selectedServiceType;
        });
      }
    }
    
    // Filter out catering add-ons when includeFood is "no" (existing logic)
    if (formData.includeFood === 'no') {
      filtered = filtered.filter(opt => {
        const label = (opt.label || '').toLowerCase();
        return !label.includes('catering');
      });
    }
    
    return filtered;
  }, [specialOptions, formData.typeService, formData.includeFood, allAddons]);
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
    const s = parseInt(step1?.guests?.senior || 0, 10) || 0;
    return a + c + p + s;
  }, [step1]);

  const numberOfSeniors = useMemo(() => {
    return parseInt(step1?.guests?.senior || 0, 10) || 0;
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

  // Calculate these values early so they can be used in useEffect hooks
  const isDormitory = formData.typeFacilities?.toLowerCase().includes('dormitory');
  const isIndividual = step1?.type?.individual;

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

  // Auto-add corkage fee and remove catering when includeFood is "no" and specialOptions are loaded
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
      
      // Remove any catering add-ons
      setSelectedAddons(prev => prev.filter(addon => {
        const label = (addon.label || '').toLowerCase();
        return !label.includes('catering');
      }));
    }
  }, [formData.includeFood, specialOptions, isDormitory, isIndividual]);

  // Ensure corkage fee remains and catering is removed when includeFood is "no" (safeguard against manual removal)
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
          // Also ensure no catering add-ons are present
          const hasCatering = prev.some(addon => {
            const label = (addon.label || '').toLowerCase();
            return label.includes('catering');
          });
          if (hasCatering) {
            return prev.filter(addon => {
              const label = (addon.label || '').toLowerCase();
              return !label.includes('catering');
            });
          }
          return prev;
        });
      } else {
        // Even if no corkage fee, remove catering
        setSelectedAddons(prev => {
          const hasCatering = prev.some(addon => {
            const label = (addon.label || '').toLowerCase();
            return label.includes('catering');
          });
          if (hasCatering) {
            return prev.filter(addon => {
              const label = (addon.label || '').toLowerCase();
              return !label.includes('catering');
            });
          }
          return prev;
        });
      }
    }
  }, [selectedAddons, formData.includeFood, specialOptions, isDormitory, isIndividual]);


  const handleGoBack = () => {
    const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
    const pwdIdFiles = location.state?.pwdIdFiles || [];
    const governmentIdFiles = location.state?.governmentIdFiles || [];
    navigate(`/reservation-form/${type}/${facilityName}/${id}`, { 
      state: { step1, step2: formData, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles } 
    });
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingSpecials(true);
        const json = await getAllAddons();
        if (!active) return;

        const arr = Array.isArray(json.addons) ? json.addons : [];
        // Store all addons with their serviceType
        setAllAddons(arr);
        const opts = arr.map((s) => ({
          value: String(s._id),
          label: s.name,
          serviceType: s.serviceType || null,
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

    // Handle includeFood change - automatically add/remove corkage fee and remove catering
    // Only process if question is visible (not dormitory and not individual)
    if (name === 'includeFood') {
      const isDorm = formData.typeFacilities?.toLowerCase().includes('dormitory');
      const isIndiv = step1?.type?.individual;
      
      // Only process if question is visible (not dormitory and not individual)
      if (!isDorm && !isIndiv) {
        setFormData(prev => ({ ...prev, [name]: value }));
        setFieldErrors(prev => ({ ...prev, [name]: undefined }));
        
        // Find corkage fee addon (case-insensitive search)
        const corkageFeeAddon = specialOptions.find(opt => 
          opt.label && opt.label.toLowerCase().includes('corkage')
        );
        
        if (value === 'no') {
          // Add corkage fee if not already in selectedAddons
          if (corkageFeeAddon) {
            setSelectedAddons(prev => {
              const exists = prev.some(addon => addon.value === corkageFeeAddon.value);
              if (!exists) {
                return [...prev, corkageFeeAddon];
              }
              return prev;
            });
          }
          
          // Remove any catering add-ons when user selects "no"
          setSelectedAddons(prev => prev.filter(addon => {
            const label = (addon.label || '').toLowerCase();
            return !label.includes('catering');
          }));
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


  const chosenFacility = facilityOptions.find(o => o._id === formData.facilityName);
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
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  useEffect(() => {
    if (isDormitory) {
      if (!formData.typeService) {
        setFormData(prev => ({ ...prev, typeService: 'Lodging' }));
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

  // Restrict individuals from selecting Conference facility type
  useEffect(() => {
    if (isIndividual && formData.typeFacilities?.toLowerCase() === 'conference') {
      // Redirect to reservation form step 1 if individual tries to access Conference
      navigate('/reservation-form', { 
        replace: true,
        state: { 
          error: 'Individuals cannot select Conference facility type. Please select Dormitory or Cottage instead.',
          step1 
        } 
      });
    }
  }, [isIndividual, formData.typeFacilities, navigate, step1]);

  // Restrict individuals to only "Lodging" service type
  useEffect(() => {
    if (isIndividual && !isDormitory) {
      // If individual has selected Event or Event and Lodging, reset to Lodging
      if (formData.typeService === 'Event' || formData.typeService === 'Event and Lodging') {
        setFormData(prev => ({ ...prev, typeService: 'Lodging' }));
      } else if (!formData.typeService) {
        // Auto-set to Lodging if no service type is selected
        setFormData(prev => ({ ...prev, typeService: 'Lodging' }));
      }
    }
  }, [isIndividual, isDormitory, formData.typeService]); 

  const handlePrevious = () => {
    const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
    const pwdIdFiles = location.state?.pwdIdFiles || [];
    const governmentIdFiles = location.state?.governmentIdFiles || [];
    navigate(`/reservation-form/${type}/${facilityName}/${id}`, { 
      state: { step1, step2: formData, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles } 
    });
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

    const hasSeniors = numberOfSeniors > 0;
    const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
    const hasPwds = numberOfPwds > 0;

    const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
    const pwdIdFiles = location.state?.pwdIdFiles || [];
    const governmentIdFiles = location.state?.governmentIdFiles || [];

    const isGovernmentCategory = step1?.category?.government === true || step1?.category?.deped === true;
    const isPwdCategory = step1?.category?.pwds === true || step1?.category?.PWDs === true;
    const isPrivateCategory = step1?.category?.private === true || step1?.category?.Private === true;

    if (isIndividual) {
      // If category is private and guest type is individual, check for seniors
      if (isPrivateCategory) {
        // If private+individual with seniors, require Senior Citizen ID
        if (hasSeniors) {
          navigate(`/reservation-step3-senior/${type}/${facilityName}/${id}`, {
            state: { step1, step2, file: null, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles },
          });
        } else {
          // If no seniors, no ID needed - go directly to step 4
          navigate(`/reservation-step4/${type}/${facilityName}/${id}`, {
            state: { step1, step2, file: null, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles },
          });
        }
      } else if (isPwdCategory) {
        // If category is PWD and guest type is individual, upload PWD ID only (no gov't or Senior Citizen ID required)
        navigate(`/reservation-step3-pwd/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file: null, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles },
        });
      } else if (isGovernmentCategory) {
        // If category is gov/deped and guest type is individual, upload gov't ID only (no PWD or Senior Citizen ID required)
        navigate(`/reservation-step3-government/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file: null, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles },
        });
      } else if (hasSeniors && hasPwds) {
        navigate(`/reservation-step3-senior/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file: null, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles },
        });
      } else if (hasSeniors) {
        navigate(`/reservation-step3-senior/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file: null, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles },
        });
      } else if (hasPwds) {
        navigate(`/reservation-step3-pwd/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file: null, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles },
        });
      } else {
        navigate(`/reservation-step4/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file: null, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles },
        });
      }
    } else {
      if (hasSeniors && hasPwds) {
        navigate(`/reservation-step3/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles },
        });
      } else if (hasSeniors) {
        navigate(`/reservation-step3/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles },
        });
      } else if (hasPwds) {
        navigate(`/reservation-step3/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles },
        });
      } else {
        navigate(`/reservation-step3/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles },
        });
      }
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
                    {(() => {
                      if (!formData.dateArrival) return 'Not specified';
                      
                      // Check if arrival time is before 2pm (early arrival)
                      const timeArrivalHour = parseInt(formData.timeArrivalHour || '02', 10) || 2;
                      const timeArrivalAMPM = formData.timeArrivalAMPM || 'PM';
                      const hour24 = timeArrivalAMPM === 'PM' && timeArrivalHour !== 12 
                        ? timeArrivalHour + 12 
                        : (timeArrivalAMPM === 'AM' && timeArrivalHour === 12 ? 0 : timeArrivalHour);
                      const isEarlyArrival = hour24 < 14;
                      
                      if (isEarlyArrival) {
                        // Adjust date to previous day
                        const arrivalDate = new Date(formData.dateArrival);
                        arrivalDate.setDate(arrivalDate.getDate() - 1);
                        return arrivalDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        });
                      }
                      
                      return new Date(formData.dateArrival).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    })()}
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
                      {formData.typeService || 'Lodging'}
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
                    {filteredSpecialOptions.map(request => (
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
                        const selectedOption = filteredSpecialOptions.find(opt => opt.value === formData.specialRequests);
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
                      {(() => {
                        if (!formData.dateArrival) return 'Not selected';
                        
                        // Check if arrival time is before 2pm (early arrival)
                        const timeArrivalHour = parseInt(formData.timeArrivalHour || '02', 10) || 2;
                        const timeArrivalAMPM = formData.timeArrivalAMPM || 'PM';
                        const hour24 = timeArrivalAMPM === 'PM' && timeArrivalHour !== 12 
                          ? timeArrivalHour + 12 
                          : (timeArrivalAMPM === 'AM' && timeArrivalHour === 12 ? 0 : timeArrivalHour);
                        const isEarlyArrival = hour24 < 14;
                        
                        if (isEarlyArrival) {
                          // Adjust date to previous day
                          const arrivalDate = new Date(formData.dateArrival);
                          arrivalDate.setDate(arrivalDate.getDate() - 1);
                          return (
                            <>
                              {arrivalDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                              <span style={{ color: '#666', fontSize: '0.85em', marginLeft: '6px', display: 'block' }}>
                                (adjusted for early check-in)
                              </span>
                            </>
                          );
                        }
                        
                        return new Date(formData.dateArrival).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        });
                      })()}
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
