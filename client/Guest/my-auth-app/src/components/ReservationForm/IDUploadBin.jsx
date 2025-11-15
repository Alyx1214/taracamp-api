import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import styles from './ResForm3.module.css';
import { ArrowLeft, UploadCloud } from 'lucide-react';

const fileCache = {
  seniorCitizenIdFiles: [],
  pwdIdFiles: [],
  governmentIdFiles: []
};

// Track the current reservation session to detect new reservations
// Store the last facility ID and step1 hash we saw
let lastReservationContext = {
  facilityId: null,
  step1Hash: null
};

const ID_TYPE_CONFIG = {
  pwd: {
    title: 'PWD RESERVATION FORM',
    formTitle: 'Upload PWD ID',
    subtitle: 'PWD ID',
    linkText: 'PWD ID Card',
    templateUrl: '#',
    sessionStorageKey: 'pwd.step3.fileNames',
    stateKey: 'pwdIdFiles',
    stateKeySingular: 'pwdIdFile',
    guestKey: 'pwds',
    errorMessage: 'At least one PWD ID file is required.',
    uploadText: 'Click to upload PWD ID (multiple files allowed)',
    description: 'to verify your eligibility for PWD benefits and discounts.',
    note: 'This section is required for PWD reservations.',
    mandatoryNote: 'Valid PWD identification is mandatory for processing your reservation.',
    disabledMessage: 'Upload at least one PWD ID file to continue.'
  },
  senior: {
    title: 'SENIOR CITIZEN RESERVATION FORM',
    formTitle: 'Upload Senior Citizen ID',
    subtitle: 'Senior Citizen ID',
    linkText: 'Senior Citizen Discount Card',
    templateUrl: '#',
    sessionStorageKey: 'seniorCitizen.step3.fileNames',
    stateKey: 'seniorCitizenIdFiles',
    stateKeySingular: 'seniorCitizenIdFile',
    guestKey: 'senior',
    errorMessage: 'At least one Senior Citizen ID file is required.',
    uploadText: 'Click to upload Senior Citizen ID (multiple files allowed)',
    description: 'to verify your eligibility for senior citizen benefits and discounts.',
    note: 'This section is required for senior citizen reservations.',
    mandatoryNote: 'Valid senior citizen identification is mandatory for processing your reservation.',
    disabledMessage: 'Upload at least one Senior Citizen ID file to continue.'
  },
  government: {
    title: 'GOVERNMENT RESERVATION FORM',
    formTitle: 'Upload Government ID',
    subtitle: 'Government ID',
    linkText: 'Government ID (e.g., UMID ID)',
    templateUrl: '#',
    sessionStorageKey: 'government.step3.fileNames',
    stateKey: 'governmentIdFiles',
    stateKeySingular: 'governmentIdFile',
    guestKey: null,
    errorMessage: 'At least one Government ID file is required.',
    uploadText: 'Click to upload Government ID (e.g., UMID ID) (multiple files allowed)',
    description: 'to verify your eligibility for government employee benefits and discounts.',
    note: 'This section is required for government group reservations.',
    mandatoryNote: 'Valid government identification (e.g., UMID ID) is mandatory for processing your reservation.',
    disabledMessage: 'Upload at least one Government ID file to continue.'
  }
};

function IDUploadForm({ idType = 'pwd' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const config = ID_TYPE_CONFIG[idType] || ID_TYPE_CONFIG.pwd;

  const { type, facilityName, id } = useParams();
  const step1 = location.state?.step1 || {};
  const step2 = location.state?.step2 || {};
  
  const numberOfGuests = config.guestKey 
    ? parseInt(step1?.guests?.[config.guestKey] || 0, 10) || 0
    : 0;
  const numberOfSeniors = parseInt(step1?.guests?.senior || 0, 10) || 0;
  const hasSeniors = numberOfSeniors > 0;
  const isGovernmentCategory = step1?.category?.government === true || step1?.category?.deped === true;
  const isGovernmentCategoryForThisIdType = idType === 'government' && isGovernmentCategory;
  const isPwdCategory = step1?.category?.pwds === true || step1?.category?.PWDs === true;
  const isPwdCategoryForThisIdType = idType === 'pwd' && isPwdCategory;
  const isPrivateCategory = step1?.category?.private === true || step1?.category?.Private === true;
  const routeType = String(type || '').toLowerCase();
  const isGroup = routeType === 'group' || !!step1?.type?.groups || !!step1?.type?.group;
  const isIndividual = step1?.type?.individual === true;
  // For private category with individual type: no ID required unless there are senior citizens (then SC ID is required)
  // For PWD category with individual type: only PWD ID is required
  // For deped/government category with individual type: only government ID is required
  const isPrivateAndIndividual = isPrivateCategory && isIndividual;
  const isPrivateAndIndividualWithSeniors = isPrivateAndIndividual && hasSeniors;
  const isRequired = (isGroup && isPrivateCategory)
    ? false // No ID required for private groups - only Letter of Intent is needed
    : isPrivateAndIndividualWithSeniors && idType === 'senior'
    ? true // Senior Citizen ID required for private+individual with seniors
    : isPrivateAndIndividual
    ? false // No ID required for private + individual (unless seniors, handled above)
    : idType === 'government' 
    ? (isGovernmentCategoryForThisIdType && (isGroup || isIndividual)) // Required for gov/deped category with group OR individual
    : idType === 'pwd'
    ? ((isPwdCategoryForThisIdType && isIndividual) || (numberOfGuests > 0 && !(isGroup && isPrivateCategory) && !(isGovernmentCategory && isIndividual))) // Required for PWD category+indiv OR (PWD guests and not private group and not gov+indiv)
    : (numberOfGuests > 0 && !(isGovernmentCategory && isIndividual)); // Skip senior ID requirement for gov/deped+indiv
  
  // Redirect private groups away from all ID upload pages - only Letter of Intent is required
  useEffect(() => {
    if (isGroup && isPrivateCategory && step1 && Object.keys(step1).length > 0) {
      const letterOfIntentFile = location.state?.file || null;
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      const governmentIdFiles = location.state?.governmentIdFiles || [];
      
      // Redirect directly to step 4 (review) - no ID needed for private groups
      navigate(`/reservation-step4/${type}/${facilityName}/${id}`, {
        state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles }
      });
    }
  }, [idType, isGroup, isPrivateCategory, step1, step2, type, facilityName, id, navigate, location.state]);
  
  // Redirect gov+indiv away from PWD and senior citizen ID upload pages to government ID upload
  useEffect(() => {
    if ((idType === 'pwd' || idType === 'senior') && isGovernmentCategory && isIndividual && step1 && Object.keys(step1).length > 0) {
      const letterOfIntentFile = location.state?.file || null;
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      const governmentIdFiles = location.state?.governmentIdFiles || [];
      
      // Redirect to government ID upload
      navigate(`/reservation-step3-government/${type}/${facilityName}/${id}`, {
        state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles }
      });
    }
  }, [idType, isGovernmentCategory, isIndividual, step1, step2, type, facilityName, id, navigate, location.state]);
  
  // Redirect PWD category+indiv away from government and senior citizen ID upload pages to PWD ID upload
  useEffect(() => {
    if ((idType === 'government' || idType === 'senior') && isPwdCategory && isIndividual && step1 && Object.keys(step1).length > 0) {
      const letterOfIntentFile = location.state?.file || null;
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      const governmentIdFiles = location.state?.governmentIdFiles || [];
      
      // Redirect to PWD ID upload
      navigate(`/reservation-step3-pwd/${type}/${facilityName}/${id}`, {
        state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles }
      });
    }
  }, [idType, isPwdCategory, isIndividual, step1, step2, type, facilityName, id, navigate, location.state]);
  
  // Redirect private+individual away from ID upload pages (except senior citizen ID if seniors present)
  useEffect(() => {
    if (isPrivateAndIndividual && step1 && Object.keys(step1).length > 0) {
      const letterOfIntentFile = location.state?.file || null;
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      const governmentIdFiles = location.state?.governmentIdFiles || [];
      
      // If private+individual with seniors and on government or PWD ID upload page, redirect to senior citizen ID upload
      if (hasSeniors && (idType === 'government' || idType === 'pwd')) {
        navigate(`/reservation-step3-senior/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles }
        });
      } else if (!hasSeniors) {
        // If no seniors, redirect directly to step 4 (review) - no ID needed for private+individual
        navigate(`/reservation-step4/${type}/${facilityName}/${id}`, {
          state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles }
        });
      }
      // If has seniors and on senior citizen ID upload page, stay on that page (don't redirect)
    }
  }, [isPrivateAndIndividual, hasSeniors, idType, step1, step2, type, facilityName, id, navigate, location.state]);

  const cacheKey = config.stateKey;
  
  // Check if we're starting a new reservation (no step1 data)
  const hasStep1 = step1 && Object.keys(step1).length > 0;
  
  // Create a hash of step1 data to identify the current reservation
  const step1Hash = hasStep1 
    ? JSON.stringify({
        groupAssociation: step1?.groupAssociation || '',
        adult: step1?.guests?.adult || '',
        senior: step1?.guests?.senior || '',
        pwds: step1?.guests?.pwds || '',
        category: step1?.category || {}
      })
    : null;
  
  // Check if this is a new reservation:
  // 1. No step1 data (starting fresh)
  // 2. Different facility ID (different reservation)
  // 3. Different step1 hash (different reservation data)
  const isNewReservation = !hasStep1 || 
    (lastReservationContext.facilityId !== null && lastReservationContext.facilityId !== id) ||
    (hasStep1 && lastReservationContext.step1Hash !== null && lastReservationContext.step1Hash !== step1Hash);
  
  // Always clear cache if facility ID changed or no step1 data
  const facilityChanged = lastReservationContext.facilityId !== null && lastReservationContext.facilityId !== id;
  const noStep1Data = !hasStep1;
  
  if (isNewReservation || facilityChanged || noStep1Data) {
    // Clear all caches
    fileCache.seniorCitizenIdFiles = [];
    fileCache.pwdIdFiles = [];
    fileCache.governmentIdFiles = [];
    // Update context tracker
    lastReservationContext = {
      facilityId: hasStep1 ? id : null,
      step1Hash: step1Hash
    };
    // Also clear sessionStorage for file names
    try {
      sessionStorage.removeItem('seniorCitizen.step3.fileNames');
      sessionStorage.removeItem('pwd.step3.fileNames');
      sessionStorage.removeItem('government.step3.fileNames');
    } catch {}
  } else if (hasStep1 && lastReservationContext.facilityId === null) {
    // First time we see step1 for this reservation - set the context
    lastReservationContext = {
      facilityId: id,
      step1Hash: step1Hash
    };
  } else if (hasStep1 && lastReservationContext.facilityId === id && lastReservationContext.step1Hash !== step1Hash) {
    // Same facility but different reservation data - clear cache
    fileCache.seniorCitizenIdFiles = [];
    fileCache.pwdIdFiles = [];
    fileCache.governmentIdFiles = [];
    lastReservationContext = {
      facilityId: id,
      step1Hash: step1Hash
    };
    try {
      sessionStorage.removeItem('seniorCitizen.step3.fileNames');
      sessionStorage.removeItem('pwd.step3.fileNames');
      sessionStorage.removeItem('government.step3.fileNames');
    } catch {}
  }
  
  const initializeFiles = () => {
    // If starting a new reservation or no step1 data, ignore any files from location.state or cache
    if (isNewReservation || !hasStep1) {
      return [];
    }
    
    const stateFiles = location.state?.[config.stateKey] || 
      (location.state?.[config.stateKeySingular] ? [location.state[config.stateKeySingular]] : []);
    const validStateFiles = Array.isArray(stateFiles) && stateFiles.length > 0 
      ? stateFiles.filter(f => f && (f instanceof File || f.name))
      : [];
    
    if (validStateFiles.length > 0) {
      // Only cache if we have step1 data (not a new reservation)
      // Verify the files belong to the current reservation by checking facility ID and step1 hash
      // If context is null, we just detected a new reservation, so don't accept files from location.state
      const contextMatches = lastReservationContext.facilityId !== null && 
        lastReservationContext.facilityId === id && 
        lastReservationContext.step1Hash === step1Hash;
      
      if (contextMatches) {
        fileCache[cacheKey] = validStateFiles;
        return validStateFiles;
      } else {
        // Files from different reservation or new reservation detected - don't use them
        return [];
      }
    }
    
    // Only use cache if we have step1 data and it matches current reservation
    if (fileCache[cacheKey] && fileCache[cacheKey].length > 0) {
      // If context is null, this is the first time seeing this reservation, so don't use old cache
      if (lastReservationContext.facilityId === null) {
        // Clear old cache since we're starting a new reservation
        fileCache[cacheKey] = [];
        return [];
      }
      
      if (lastReservationContext.facilityId === id && lastReservationContext.step1Hash === step1Hash) {
        return fileCache[cacheKey];
      } else {
        // Cache is from different reservation - clear it
        fileCache[cacheKey] = [];
        return [];
      }
    }
    
    return [];
  };
  
  // Initialize files - but force empty if starting a new reservation
  const initialFiles = (isNewReservation || !hasStep1) ? [] : initializeFiles();
  const filesRef = useRef(initialFiles);
  const [files, setFiles] = useState(initialFiles);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef();
  const mountedRef = useRef(false);

  // Force clear files if starting a new reservation
  useEffect(() => {
    if (isNewReservation || !hasStep1) {
      // Clear files state
      if (files.length > 0) {
        setFiles([]);
      }
      filesRef.current = [];
      // Also ensure all caches are cleared (already cleared above, but double-check)
      fileCache.seniorCitizenIdFiles = [];
      fileCache.pwdIdFiles = [];
      fileCache.governmentIdFiles = [];
      // Clear sessionStorage
      try {
        sessionStorage.removeItem('seniorCitizen.step3.fileNames');
        sessionStorage.removeItem('pwd.step3.fileNames');
        sessionStorage.removeItem('government.step3.fileNames');
      } catch {}
    }
  }, [isNewReservation, hasStep1, files.length]);

  // Cleanup effect: Clear cache when component unmounts if no step1 data
  useEffect(() => {
    return () => {
      // Only clear on unmount if we don't have step1 data (user navigating away from reservation flow)
      if (!hasStep1) {
        fileCache.seniorCitizenIdFiles = [];
        fileCache.pwdIdFiles = [];
        fileCache.governmentIdFiles = [];
        try {
          sessionStorage.removeItem('seniorCitizen.step3.fileNames');
          sessionStorage.removeItem('pwd.step3.fileNames');
          sessionStorage.removeItem('government.step3.fileNames');
        } catch {}
      }
    };
  }, [hasStep1]);

  useEffect(() => {
    if (files.length > 0) {
      filesRef.current = files;
      // Only update cache if we have step1 data and context matches current reservation
      const contextMatches = lastReservationContext.facilityId !== null && 
        lastReservationContext.facilityId === id && 
        lastReservationContext.step1Hash === step1Hash;
      
      if (hasStep1 && contextMatches) {
        fileCache[cacheKey] = files;
      } else {
        // If step1 becomes empty or context doesn't match, clear the cache for this key
        fileCache[cacheKey] = [];
      }
    }
  }, [files, cacheKey, hasStep1, id, step1Hash]);

  useEffect(() => {
    // If starting a new reservation or no step1 data, ignore any files from location.state and clear files
    if (isNewReservation || !hasStep1) {
      setFiles([]);
      filesRef.current = [];
      return;
    }
    
    // Verify files belong to current reservation
    const contextMatches = lastReservationContext.facilityId !== null && 
      lastReservationContext.facilityId === id && 
      lastReservationContext.step1Hash === step1Hash;
    
    if (!contextMatches) {
      // Different reservation - don't use files from location.state or cache
      setFiles([]);
      filesRef.current = [];
      return;
    }
    
    if (!mountedRef.current) {
      const stateFiles = location.state?.[config.stateKey] || 
        (location.state?.[config.stateKeySingular] ? [location.state[config.stateKeySingular]] : []);
      
      if (stateFiles && Array.isArray(stateFiles) && stateFiles.length > 0) {
        const validFiles = stateFiles.filter(f => f && (f instanceof File || f.name));
        if (validFiles.length > 0) {
          setFiles(validFiles);
          filesRef.current = validFiles;
          fileCache[cacheKey] = validFiles;
        }
      } else if (fileCache[cacheKey] && fileCache[cacheKey].length > 0) {
        // Only use cache if context matches current reservation
        setFiles(fileCache[cacheKey]);
        filesRef.current = fileCache[cacheKey];
      }
      mountedRef.current = true;
      return;
    }

    const stateFiles = location.state?.[config.stateKey] || 
      (location.state?.[config.stateKeySingular] ? [location.state[config.stateKeySingular]] : []);
    
    if (stateFiles && Array.isArray(stateFiles) && stateFiles.length > 0) {
      const validFiles = stateFiles.filter(f => f && (f instanceof File || f.name));
      if (validFiles.length > 0) {
        const currentFiles = filesRef.current.length > 0 ? filesRef.current : files;
        const currentFileNames = currentFiles.map(f => f?.name || '').filter(Boolean).sort().join(',');
        const stateFileNames = validFiles.map(f => f?.name || '').filter(Boolean).sort().join(',');
        
        if (currentFileNames !== stateFileNames) {
          setFiles(validFiles);
          filesRef.current = validFiles;
          fileCache[cacheKey] = validFiles;
        }
      }
    } else if (files.length === 0 && fileCache[cacheKey] && fileCache[cacheKey].length > 0) {
      // Only use cache if context matches current reservation
      setFiles(fileCache[cacheKey]);
      filesRef.current = fileCache[cacheKey];
    }
  }, [location.state, config.stateKey, config.stateKeySingular, files, cacheKey, hasStep1, isNewReservation, id, step1Hash]);

  useEffect(() => {
    if (!step1 || !Object.keys(step1).length || !step2 || !Object.keys(step2).length) {
      // If starting a new reservation, don't pass any files from location.state
      const currentFiles = isNewReservation ? [] : (filesRef.current.length > 0 ? filesRef.current : files);
      const seniorCitizenIdFiles = isNewReservation ? [] : (location.state?.seniorCitizenIdFiles || []);
      const pwdIdFiles = isNewReservation ? [] : (location.state?.pwdIdFiles || []);
      const governmentIdFiles = isNewReservation ? [] : (location.state?.governmentIdFiles || []);
      navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { 
        state: { 
          step1, 
          step2, 
          file: isNewReservation ? null : location.state?.file,
          seniorCitizenIdFiles,
          pwdIdFiles,
          governmentIdFiles,
          [config.stateKey]: currentFiles 
        } 
      });
    }
  }, [step1, step2, type, facilityName, id, navigate, files, config.stateKey, location.state, isNewReservation]);

  useEffect(() => {
    try {
      if (files.length > 0) {
        const fileNames = files.map(f => f?.name || '').filter(Boolean).join(', ');
        sessionStorage.setItem(config.sessionStorageKey, fileNames);
      }
    } catch {}
  }, [files, config.sessionStorageKey]);

  useEffect(() => {
    if (mountedRef.current && files.length > 0) {
      const stateFiles = location.state?.[config.stateKey] || 
        (location.state?.[config.stateKeySingular] ? [location.state[config.stateKeySingular]] : []);
      
      if ((!stateFiles || stateFiles.length === 0) && files.length > 0) {
        filesRef.current = files;
      }
    }
  }, [location.state, config.stateKey, config.stateKeySingular, files]);

  const handleGoBack = () => {
    const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
    const pwdIdFiles = location.state?.pwdIdFiles || [];
    const governmentIdFiles = location.state?.governmentIdFiles || [];
    navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { 
      state: { 
        step1, 
        step2, 
        file: location.state?.file,
        seniorCitizenIdFiles,
        pwdIdFiles,
        governmentIdFiles,
        [config.stateKey]: files 
      } 
    });
  };

  const handlePrevious = () => {
    const currentFiles = filesRef.current.length > 0 ? filesRef.current : files;
    
    const routeType = String(type || '').toLowerCase();
    const isGroup = routeType === 'group' || !!step1?.type?.groups || !!step1?.type?.group;
    
    if (idType === 'pwd') {
      // For PWD category groups: route back to letter of intent (not senior citizen ID)
      // Only PWD ID is needed, not senior citizen ID
      if (isGroup) {
        const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
        const governmentIdFiles = location.state?.governmentIdFiles || [];
        navigate(`/reservation-step3/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: location.state?.file, 
            seniorCitizenIdFiles,
            governmentIdFiles,
            [config.stateKey]: currentFiles 
          } 
        });
        return;
      }
    } else if (idType === 'government') {
      if (isGroup) {
        const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
        const pwdIdFiles = location.state?.pwdIdFiles || [];
        navigate(`/reservation-step3/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: location.state?.file, 
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles
          } 
        });
        return;
      }
    } else {
      if (isGroup) {
        const pwdIdFiles = location.state?.pwdIdFiles || [];
        const governmentIdFiles = location.state?.governmentIdFiles || [];
        navigate(`/reservation-step3/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: location.state?.file, 
            [config.stateKey]: currentFiles,
            pwdIdFiles,
            governmentIdFiles
          } 
        });
        return;
      }
    }
    
    const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
    const pwdIdFiles = location.state?.pwdIdFiles || [];
    const governmentIdFiles = location.state?.governmentIdFiles || [];
    navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { 
      state: { 
        step1, 
        step2, 
        file: location.state?.file,
        seniorCitizenIdFiles,
        pwdIdFiles,
        governmentIdFiles,
        [config.stateKey]: currentFiles 
      } 
    });
  };

  const handleNext = () => {
    const currentFiles = filesRef.current.length > 0 ? filesRef.current : files;
    
    if (isRequired && currentFiles.length === 0) {
      setFileError(config.errorMessage);
      return;
    }
    setFileError('');
    
    const letterOfIntentFile = location.state?.file || null;
    
    if (idType === 'senior') {
      const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
      const hasPwds = numberOfPwds > 0;
      
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      
      // For private+individual with seniors: only Senior Citizen ID is needed, go directly to step 4
      if (isPrivateAndIndividualWithSeniors) {
        navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            pwdIdFiles
          } 
        });
      } else if (hasPwds && !(isGroup && isPrivateCategory)) {
        // For private groups: skip PWD ID even if PWDs are present
        navigate(`/reservation-step3-pwd/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            pwdIdFiles
          } 
        });
      } else {
        navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            pwdIdFiles
          } 
        });
      }
    } else if (idType === 'government') {
      const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
      const hasPwds = numberOfPwds > 0;
      
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      
      // For gov't/deped category with individual type: only gov't ID is needed (no PWD or Senior Citizen ID required) - route directly to step 4
      if (isGovernmentCategoryForThisIdType && isIndividual) {
        navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles
          } 
        });
      } else if (hasSeniors) {
        // For gov't/deped groups with seniors: skip senior citizen ID upload
        // Only gov't/deped ID is needed - route directly to step 4
        navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles
          } 
        });
      } else if (hasPwds) {
        navigate(`/reservation-step3-pwd/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles
          } 
        });
      } else {
        navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles
          } 
        });
      }
    } else if (idType === 'pwd') {
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const governmentIdFiles = location.state?.governmentIdFiles || [];
      
      // For PWD category with individual type: only PWD ID is needed (no gov't or Senior Citizen ID required) - route directly to step 4
      if (isPwdCategory && isIndividual) {
        navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            governmentIdFiles
          } 
        });
      } else if (isPwdCategory && hasSeniors) {
        // For PWD category groups with seniors: skip senior citizen ID upload
        // Only PWD ID is needed - route directly to step 4
        navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            governmentIdFiles
          } 
        });
      } else {
        navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            seniorCitizenIdFiles: location.state?.seniorCitizenIdFiles || [],
            [config.stateKey]: currentFiles
          } 
        });
      }
    } else {
      navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
        state: { 
          step1, 
          step2, 
          file: letterOfIntentFile,
          seniorCitizenIdFiles: location.state?.seniorCitizenIdFiles || [],
          [config.stateKey]: currentFiles
        } 
      });
    }
  };

  const handleBoxClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = e => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const validFiles = [];
      
      for (const f of newFiles) {
        const okType =
          [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
            'image/jpg'
          ].includes(f.type) || /\.(pdf|docx?|jpe?g|png)$/i.test(f.name);

        if (!okType) {
          setFileError('Please upload PDF, Word document, or image files (JPG, PNG) only.');
          continue;
        }
        if (f.size > 5 * 1024 * 1024) {
          setFileError('One or more files are too large. Max 5 MB per file.');
          continue;
        }
        validFiles.push(f);
      }

      if (validFiles.length > 0) {
        setFileError('');
        setFiles(prev => {
          const updated = [...prev, ...validFiles];
          filesRef.current = updated;
          return updated;
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else if (newFiles.length > 0) {
        return;
      }
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      filesRef.current = updated;
      // Only cache if we have step1 data and context matches current reservation
      const contextMatches = lastReservationContext.facilityId !== null && 
        lastReservationContext.facilityId === id && 
        lastReservationContext.step1Hash === step1Hash;
      
      if (hasStep1 && contextMatches) {
        fileCache[cacheKey] = updated;
      }
      return updated;
    });
    setFileError('');
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
            <h1 className={styles.pageTitle}>{config.title}</h1>
          </div>
          <div className={styles.formCard}>
            <div className={styles.formTitle}>
              {config.formTitle}
              <span className={styles.requiredAsterisk}>*</span>
            </div>
            <div className={styles.formSubtitle}>
              → Please upload a clear copy of your {config.subtitle}  {config.description}
            </div>
            <div className={styles.groupNote}>{config.note}</div>
            {isRequired && <div className={styles.groupNote}>{config.mandatoryNote}</div>}
            {idType === 'government' && hasSeniors && (
              <div className={styles.groupNote} style={{ color: '#0066cc', fontWeight: '500' }}>
                Note: Only one type of discount applies. Since you have selected government/DepEd category{isIndividual ? ' with individual type' : ''}, only government/DepEd ID is required. Senior citizen discount will not apply.
              </div>
            )}
            {idType === 'pwd' && isPwdCategory && isIndividual && !hasSeniors && (
              <div className={styles.groupNote} style={{ color: '#0066cc', fontWeight: '500' }}>
                Note: Since you have selected PWD category with individual type, only PWD ID is required. Government ID and Senior Citizen ID are not required.
              </div>
            )}
            {idType === 'pwd' && isPwdCategory && hasSeniors && (
              <div className={styles.groupNote} style={{ color: '#0066cc', fontWeight: '500' }}>
                Note: Only one type of discount applies. Since you have selected PWD category{isIndividual ? ' with individual type' : ''}, only PWD ID is required. Senior citizen discount will not apply.
              </div>
            )}
            <div className={styles.uploadBox} onClick={handleBoxClick} role="button" tabIndex={0}>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <UploadCloud className={styles.uploadIcon} />
              <div className={styles.uploadText}>
                {files.length > 0 ? `${files.length} file(s) selected` : config.uploadText}
              </div>
            </div>
            {files.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {files.map((f, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#e8f4fd',
                      border: '1px solid #b3d8f2',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '13px',
                      gap: '8px'
                    }}
                  >
                    <span>{f.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(index);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#666',
                        cursor: 'pointer',
                        fontSize: '16px',
                        lineHeight: '1',
                        padding: '0',
                        marginLeft: '4px'
                      }}
                      title="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {fileError && <div className={styles.fieldError} style={{ marginTop: 8 }}>{fileError}</div>}

            <div className={styles.infoText}>Kindly double check the following information before submitting.</div>
            <div className={styles.buttonContainer}>
              <button type="button" onClick={handlePrevious} className={styles.previousButton}>
                Previous
              </button>
              <button
                type="button"
                onClick={handleNext}
                className={styles.nextButton}
                disabled={isRequired && files.length === 0}
                title={isRequired && files.length === 0 ? config.disabledMessage : undefined}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function PWDReservationForm() {
  return <IDUploadForm idType="pwd" />;
}

export function SeniorCitizenReservationForm() {
  return <IDUploadForm idType="senior" />;
}

export function GovernmentReservationForm() {
  return <IDUploadForm idType="government" />;
}

export default IDUploadForm;

