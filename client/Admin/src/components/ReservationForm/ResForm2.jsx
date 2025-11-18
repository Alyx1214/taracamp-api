import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
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
  const { type, facilityName, id } = useParams();

  const step1 = location.state?.step1 || {};
  const file = location.state?.file || null;
  const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
  const pwdIdFiles = location.state?.pwdIdFiles || [];
  const governmentIdFiles = location.state?.governmentIdFiles || [];
  const depedIdFiles = location.state?.depedIdFiles || [];
  const seniorCitizenIdFilesRef = useRef(seniorCitizenIdFiles);
  const pwdIdFilesRef = useRef(pwdIdFiles);
  const governmentIdFilesRef = useRef(governmentIdFiles);
  const depedIdFilesRef = useRef(depedIdFiles);

  useEffect(() => {
    if (location.state?.seniorCitizenIdFiles !== undefined) {
      seniorCitizenIdFilesRef.current = location.state?.seniorCitizenIdFiles || [];
    }
  }, [location.state?.seniorCitizenIdFiles]);

  useEffect(() => {
    if (location.state?.pwdIdFiles !== undefined) {
      pwdIdFilesRef.current = location.state?.pwdIdFiles || [];
    }
  }, [location.state?.pwdIdFiles]);

  useEffect(() => {
    if (location.state?.governmentIdFiles !== undefined) {
      governmentIdFilesRef.current = location.state?.governmentIdFiles || [];
    }
  }, [location.state?.governmentIdFiles]);

  useEffect(() => {
    if (location.state?.depedIdFiles !== undefined) {
      depedIdFilesRef.current = location.state?.depedIdFiles || [];
    }
  }, [location.state?.depedIdFiles]);
  const reservationId = location.state?.reservationId || null;
  const isEdit = location.state?.isEdit || false;
  const userEmail = location.state?.userEmail || null;
  const originalType = location.state?.originalType || null; // Original type from edit mode
  const originalStatus = location.state?.originalStatus || null;
  const fromCheckInOut = location.state?.fromCheckInOut || false;
  const activeTab = location.state?.activeTab || null;
  const filters = location.state?.filters || null;

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
        navigate(`/reservation-form`, { replace: true });
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
  const [loadingFacilities, setLoadingFacilities] = useState(false);
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
    const s = parseInt(step1?.guests?.senior || 0, 10) || 0;
    return a + c + p + s;
  }, [step1]);

  const numberOfSeniors = useMemo(() => {
    return parseInt(step1?.guests?.senior || 0, 10) || 0;
  }, [step1]);

  useEffect(() => {
    let hydrated = false;
    if (location.state?.step2) {
      // step2.dateArrival is now the original date (not adjusted)
      // We can use it directly
      setFormData(prev => ({
        ...prev,
        ...location.state.step2,
        typeFacilities: prev.typeFacilities || urlFacilityType || location.state.step2.typeFacilities || ''
      }));
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
  }, [location.state, urlFacilityType, isEdit]);

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
    navigate(`/reservation-form`, { state: { step1, step2: formData, file, seniorCitizenIdFiles: seniorCitizenIdFilesRef.current, pwdIdFiles: pwdIdFilesRef.current, governmentIdFiles: governmentIdFilesRef.current, depedIdFiles: depedIdFilesRef.current, reservationId, isEdit, userEmail, originalType, originalStatus, fromCheckInOut, activeTab, filters } });
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

          const urlMatch = list.find(o => o._id === String(id));
          return urlMatch ? { ...prev, facilityName: urlMatch._id } : prev;

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

    // Handle includeFood change - automatically add/remove corkage fee and remove catering
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

    // Reset arrival time to 2pm when arrival date changes
    if (name === 'dateArrival') {
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        timeArrivalHour: '02',
        timeArrivalAMPM: 'PM'
      }));
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
      setIsAvailable(null);
      setAvailReason('');
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    setFieldErrors(prev => ({ ...prev, [name]: undefined }));

    if (name === 'dateDeparture') {
      setIsAvailable(null);
      setAvailReason('');
    }
  };


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
  }, [isDormitory, formData.typeService, autoSetServiceForDorm]);

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
    navigate(`/reservation-form`, { state: { step1, step2: formData, file, seniorCitizenIdFiles: seniorCitizenIdFilesRef.current, pwdIdFiles: pwdIdFilesRef.current, governmentIdFiles: governmentIdFilesRef.current, depedIdFiles: depedIdFilesRef.current, reservationId, isEdit, userEmail, originalType, originalStatus, fromCheckInOut, activeTab, filters } });
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

    // Note: We don't adjust the date here - the backend will handle the adjustment in computeEstimate
    // The backend validates the original date, then adjusts it internally for billing purposes
    // We only adjust the date for display purposes in the UI
    const step2 = {
      ...formData,
      // Keep the original dateArrival - backend will adjust it if needed
      dateArrival: formData.dateArrival,
      facilityIdFromList: chosen._id,
      facilityLabelFromList: chosen.label,
      facilityCapacity: chosen.capacity,
      facilityRatePerPerson: chosen.ratePerPerson,
      selectedAddons: selectedAddons,
    };

    const isGroup = step1?.type?.groups || false;
    const isIndividual = step1?.type?.individual || false;
    
    // Detect if type changed from individual to group in edit mode
    const typeChangedToGroup = isEdit && originalType && 
      (originalType === 'Individual' || originalType === 'individual') && 
      isGroup;
    
    // Get current file from location.state to ensure it's up to date
    // If type changed from individual to group, clear the file (individuals don't have Letter of Intent)
    let currentFile = location.state?.file || file || null;
    if (typeChangedToGroup) {
      // If changing from individual to group, clear any existing file
      // because individual reservations don't have Letter of Intent
      currentFile = null;
    }
    
    // Check for seniors and PWDs to determine routing
    const numberOfSeniors = parseInt(step1?.guests?.senior || 0, 10) || 0;
    const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
    const hasSeniors = numberOfSeniors > 0;
    const hasPwds = numberOfPwds > 0;
    
    // Check category
    const isGovernmentCategory = step1?.category?.government === true || step1?.category?.deped === true;
    const isPwdCategory = step1?.category?.pwds === true || step1?.category?.PWDs === true;
    const isPrivateCategory = step1?.category?.private === true || step1?.category?.Private === true;
    
    let nextStep;
    if (isGroup) {
      // Group reservations: go to Letter of Intent first
      // If type changed from individual to group, Letter of Intent is now required
      nextStep = `/reservation-step3`;
    } else if (isIndividual) {
      // Individual reservations: check category first
      if (isPrivateCategory) {
        // Private+individual: check for seniors
        if (hasSeniors) {
          // Private+individual with seniors: require Senior Citizen ID
          nextStep = `/reservation-step3-senior`;
        } else {
          // Private+individual without seniors: no ID needed, go directly to step 4
          nextStep = `/reservation-step4`;
        }
      } else if (isPwdCategory) {
        // PWD+individual: only PWD ID needed (even if seniors present)
        nextStep = `/reservation-step3-pwd`;
      } else if (isGovernmentCategory) {
        // Government/deped+individual: only government ID needed (even if seniors present)
        nextStep = `/reservation-step3-government`;
      } else if (hasSeniors && hasPwds) {
        // Individual with both seniors and PWDs: go to senior citizen ID first
        nextStep = `/reservation-step3-senior`;
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
    } else {
      // Fallback: go to step 3 (Letter of Intent)
      nextStep = `/reservation-step3`;
    }
    
    navigate(nextStep, {
      state: { 
        step1, 
        step2, 
        file: currentFile, 
        seniorCitizenIdFiles: seniorCitizenIdFilesRef.current, 
        pwdIdFiles: pwdIdFilesRef.current, 
        governmentIdFiles: governmentIdFilesRef.current,
        depedIdFiles: depedIdFilesRef.current,
        reservationId, 
        isEdit, 
        userEmail,
        originalType: originalType, // Pass original type to next step
        typeChangedToGroup: typeChangedToGroup, // Flag indicating type changed to group
        originalStatus: originalStatus, // Pass original status to preserve it
        fromCheckInOut: fromCheckInOut, // Pass check-in/out context
        activeTab: activeTab, // Pass active tab
        filters: filters // Pass filters
      },
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
                  {(() => {
                    // Calculate adjusted date for display if arrival time is before 2pm
                    let displayDate = formData.dateArrival;
                    if (formData.dateArrival && formData.timeArrivalHour) {
                      const timeArrivalHour = parseInt(formData.timeArrivalHour || '02', 10) || 2;
                      const timeArrivalAMPM = formData.timeArrivalAMPM || 'PM';
                      const hour24 = timeArrivalAMPM === 'PM' && timeArrivalHour !== 12 
                        ? timeArrivalHour + 12 
                        : (timeArrivalAMPM === 'AM' && timeArrivalHour === 12 ? 0 : timeArrivalHour);
                      const isEarlyArrival = hour24 < 14;
                      
                      if (isEarlyArrival) {
                        // Adjust date to previous day for display
                        const arrivalDate = new Date(formData.dateArrival);
                        arrivalDate.setDate(arrivalDate.getDate() - 1);
                        const year = arrivalDate.getFullYear();
                        const month = String(arrivalDate.getMonth() + 1).padStart(2, '0');
                        const day = String(arrivalDate.getDate()).padStart(2, '0');
                        displayDate = `${year}-${month}-${day}`;
                      }
                    }
                    
                    return (
                      <input
                        type="date"
                        name="dateArrival"
                        min={minArrival}
                        value={displayDate}
                        onChange={(e) => {
                          // When user changes the date, if time is before 2pm, adjust it back to original
                          let originalDate = e.target.value;
                          if (formData.timeArrivalHour) {
                            const timeArrivalHour = parseInt(formData.timeArrivalHour || '02', 10) || 2;
                            const timeArrivalAMPM = formData.timeArrivalAMPM || 'PM';
                            const hour24 = timeArrivalAMPM === 'PM' && timeArrivalHour !== 12 
                              ? timeArrivalHour + 12 
                              : (timeArrivalAMPM === 'AM' && timeArrivalHour === 12 ? 0 : timeArrivalHour);
                            const isEarlyArrival = hour24 < 14;
                            
                            if (isEarlyArrival) {
                              // User is editing the adjusted date, so add one day to get the original
                              const date = new Date(originalDate);
                              date.setDate(date.getDate() + 1);
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              originalDate = `${year}-${month}-${day}`;
                            }
                          }
                          // Reset time to 2pm when date changes
                          setFormData(prev => ({ 
                            ...prev, 
                            dateArrival: originalDate,
                            timeArrivalHour: '02',
                            timeArrivalAMPM: 'PM'
                          }));
                          setFieldErrors(prev => ({ ...prev, dateArrival: undefined }));
                          setIsAvailable(null);
                          setAvailReason('');
                        }}
                        className={`${styles.input} ${fieldErrors.dateArrival ? styles.inputError : ''}`}
                      />
                    );
                  })()}
                  {fieldErrors.dateArrival && (
                    <div className={styles.fieldError}>{fieldErrors.dateArrival}</div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Date of Departure <span className={styles.required}>*</span></label>
                  {(() => {
                    // Calculate min date for departure - should be based on the displayed arrival date (adjusted if early arrival)
                    let minDepartureDate = formData.dateArrival || minArrival;
                    if (formData.dateArrival && formData.timeArrivalHour) {
                      const timeArrivalHour = parseInt(formData.timeArrivalHour || '02', 10) || 2;
                      const timeArrivalAMPM = formData.timeArrivalAMPM || 'PM';
                      const hour24 = timeArrivalAMPM === 'PM' && timeArrivalHour !== 12 
                        ? timeArrivalHour + 12 
                        : (timeArrivalAMPM === 'AM' && timeArrivalHour === 12 ? 0 : timeArrivalHour);
                      const isEarlyArrival = hour24 < 14;
                      
                      if (isEarlyArrival) {
                        // Use adjusted arrival date as min for departure
                        const arrivalDate = new Date(formData.dateArrival);
                        arrivalDate.setDate(arrivalDate.getDate() - 1);
                        const year = arrivalDate.getFullYear();
                        const month = String(arrivalDate.getMonth() + 1).padStart(2, '0');
                        const day = String(arrivalDate.getDate()).padStart(2, '0');
                        minDepartureDate = `${year}-${month}-${day}`;
                      }
                    }
                    
                    return (
                      <input
                        type="date"
                        name="dateDeparture"
                        min={minDepartureDate}
                        value={formData.dateDeparture}
                        onChange={handleInputChange}
                        className={`${styles.input} ${fieldErrors.dateDeparture ? styles.inputError : ''}`}
                      />
                    );
                  })()}
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
                  <label className={styles.label}>Time of Arrival <span className={styles.required}>*</span></label>
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
