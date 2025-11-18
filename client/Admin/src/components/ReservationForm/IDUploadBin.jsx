import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './ResForm3.module.css';
import { UploadCloud } from 'lucide-react';

const fileCache = {
  seniorCitizenIdFiles: [],
  pwdIdFiles: [],
  governmentIdFiles: [],
  depedIdFiles: []
};

// Configuration for different ID types
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
  },
  deped: {
    title: 'DEPED RESERVATION FORM',
    formTitle: 'Upload DepEd ID',
    subtitle: 'DepEd ID',
    linkText: 'DepEd ID',
    templateUrl: '#',
    sessionStorageKey: 'deped.step3.fileNames',
    stateKey: 'depedIdFiles',
    stateKeySingular: 'depedIdFile',
    guestKey: null,
    errorMessage: 'At least one DepEd ID file is required.',
    uploadText: 'Click to upload DepEd ID (multiple files allowed)',
    description: 'to verify your eligibility for DepEd employee benefits and discounts.',
    note: 'This section is required for DepEd reservations.',
    mandatoryNote: 'Valid DepEd identification is mandatory for processing your reservation.',
    disabledMessage: 'Upload at least one DepEd ID file to continue.'
  }
};

function IDUploadForm({ idType = 'pwd' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const config = ID_TYPE_CONFIG[idType] || ID_TYPE_CONFIG.pwd;

  const step1 = location.state?.step1 || {};
  const step2 = location.state?.step2 || {};
  const reservationId = location.state?.reservationId || null;
  const isEdit = location.state?.isEdit || false;
  const userEmail = location.state?.userEmail || null;
  const originalType = location.state?.originalType || null;
  const typeChangedToGroup = location.state?.typeChangedToGroup || false;
  
  const numberOfGuests = config.guestKey 
    ? parseInt(step1?.guests?.[config.guestKey] || 0, 10) || 0
    : 0;
  const numberOfSeniors = parseInt(step1?.guests?.senior || 0, 10) || 0;
  const hasSeniors = numberOfSeniors > 0;
  const isGovernmentCategory = step1?.category?.government === true;
  const isDepEdCategory = step1?.category?.deped === true;
  const isGovernmentCategoryForThisIdType = idType === 'government' && isGovernmentCategory;
  const isDepEdCategoryForThisIdType = idType === 'deped' && isDepEdCategory;
  const isPwdCategory = step1?.category?.pwds === true || step1?.category?.PWDs === true;
  const isPwdCategoryForThisIdType = idType === 'pwd' && isPwdCategory;
  const isPrivateCategory = step1?.category?.private === true || step1?.category?.Private === true;
  const isGroup = !!step1?.type?.groups || !!step1?.type?.group;
  const isIndividual = step1?.type?.individual === true;
  // For private category with individual type: no ID required unless there are senior citizens (then SC ID is required)
  // For PWD category with individual type: only PWD ID is required
  // For deped/government category with individual type: only deped/government ID is required
  const isPrivateAndIndividual = isPrivateCategory && isIndividual;
  const isPrivateAndIndividualWithSeniors = isPrivateAndIndividual && hasSeniors;
  const isRequired = (isGroup && isPrivateCategory)
    ? (numberOfGuests > 0) // IDs are required for private groups when guests of that type are present
    : isPrivateAndIndividualWithSeniors && idType === 'senior'
    ? true // Senior Citizen ID required for private+individual with seniors
    : isPrivateAndIndividual
    ? false // No ID required for private + individual (unless seniors, handled above)
    : idType === 'government' 
    ? (isGovernmentCategoryForThisIdType && (isGroup || isIndividual)) // Required for government category with group OR individual
    : idType === 'deped'
    ? (isDepEdCategoryForThisIdType && (isGroup || isIndividual)) // Required for DepEd category with group OR individual
    : idType === 'pwd'
    ? ((isPwdCategoryForThisIdType && isIndividual) || (numberOfGuests > 0 && !(isGroup && isPrivateCategory) && !(isGovernmentCategory && isIndividual) && !(isDepEdCategory && isIndividual))) // Required for PWD category+indiv OR (PWD guests and not private group and not gov/deped+indiv)
    : (numberOfGuests > 0 && !(isGovernmentCategory && isIndividual) && !(isDepEdCategory && isIndividual)); // Skip senior ID requirement for gov/deped+indiv

  const cacheKey = config.stateKey;
  
  // ID files should be independent from other files
  const getStateFiles = () => {
    const stateFiles = location.state?.[config.stateKey] || 
      (location.state?.[config.stateKeySingular] ? [location.state[config.stateKeySingular]] : []);
    return Array.isArray(stateFiles) ? stateFiles : [];
  };

  // Initialize files from state or cache
  const initializeFiles = () => {
    const stateFiles = getStateFiles();
    const validStateFiles = Array.isArray(stateFiles) && stateFiles.length > 0 
      ? stateFiles.filter(f => f && (f instanceof File || f.name || f.url))
      : [];
    
    if (validStateFiles.length > 0) {
      // Cache files from state
      fileCache[cacheKey] = validStateFiles;
      return validStateFiles;
    }
    
    // Use cache if available
    if (fileCache[cacheKey] && fileCache[cacheKey].length > 0) {
      return fileCache[cacheKey];
    }
    
    return [];
  };

  const initialFiles = initializeFiles();
  const filesRef = useRef(initialFiles);
  const [files, setFiles] = useState(initialFiles);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef();
  const mountedRef = useRef(false);

  // Always update filesRef when files change (including when files are deleted)
  useEffect(() => {
    filesRef.current = files;
    fileCache[cacheKey] = files;
  }, [files, cacheKey]);

  // Initialize files on mount and update when location.state changes
  useEffect(() => {
    if (!mountedRef.current) {
      const stateFiles = getStateFiles();
      const validStateFiles = Array.isArray(stateFiles) && stateFiles.length > 0 
        ? stateFiles.filter(f => f && (f instanceof File || f.name || f.url))
        : [];
      
      // On initial mount, always set files from state if they exist (like letter of intent)
      if (validStateFiles.length > 0) {
        setFiles(validStateFiles);
        filesRef.current = validStateFiles;
        fileCache[cacheKey] = validStateFiles;
      } else if (fileCache[cacheKey] && fileCache[cacheKey].length > 0) {
        // Use cache if available
        setFiles(fileCache[cacheKey]);
        filesRef.current = fileCache[cacheKey];
      }
      mountedRef.current = true;
      return;
    }

    const stateFiles = getStateFiles();
    const validStateFiles = Array.isArray(stateFiles) && stateFiles.length > 0 
      ? stateFiles.filter(f => f && (f instanceof File || f.name || f.url))
      : [];
    
    if (validStateFiles.length > 0) {
      // Only update if state files are different from current files
      // This prevents restoring deleted files when navigating back
      const currentFiles = files.length > 0 ? files : (filesRef.current.length > 0 ? filesRef.current : []);
      // Compare files by both name and URL to handle files with URL but no name
      const currentFileKeys = currentFiles.map(f => {
        if (f instanceof File) return f.name;
        return f?.name || f?.url || '';
      }).filter(Boolean).sort().join(',');
      const stateFileKeys = validStateFiles.map(f => {
        if (f instanceof File) return f.name;
        return f?.name || f?.url || '';
      }).filter(Boolean).sort().join(',');
      
      // Only restore from state if files are different AND we don't have current files
      // This ensures deleted files don't come back
      if (currentFileKeys !== stateFileKeys && currentFiles.length === 0) {
        setFiles(validStateFiles);
        filesRef.current = validStateFiles;
        fileCache[cacheKey] = validStateFiles;
      } else if (currentFileKeys !== stateFileKeys && currentFiles.length > 0) {
        // If we have current files, prefer them over state files (preserve deletions)
        // Update cache with current files instead
        fileCache[cacheKey] = currentFiles;
        filesRef.current = currentFiles;
      } else if (currentFileKeys === stateFileKeys && currentFiles.length === 0 && validStateFiles.length > 0) {
        // If files match but we don't have current files, set them (handles initial load)
        setFiles(validStateFiles);
        filesRef.current = validStateFiles;
        fileCache[cacheKey] = validStateFiles;
      }
    } else if (files.length === 0 && fileCache[cacheKey] && fileCache[cacheKey].length > 0) {
      // Only use cache if we don't have any current files
      // This prevents restoring deleted files
      setFiles(fileCache[cacheKey]);
      filesRef.current = fileCache[cacheKey];
    }
  }, [location.state, config.stateKey, config.stateKeySingular, files, cacheKey]);

  useEffect(() => {
    if (!step1 || !Object.keys(step1).length || !step2 || !Object.keys(step2).length) {
      const currentFiles = filesRef.current.length > 0 ? filesRef.current : files;
      navigate(`/reservation-step2`, { 
        state: { step1, step2, [config.stateKey]: currentFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup } 
      });
    }
  }, [step1, step2, navigate, files, config.stateKey, reservationId, isEdit, userEmail, originalType, typeChangedToGroup]);

  useEffect(() => {
    try {
      const fileNames = files.map(f => f.name).join(', ');
      sessionStorage.setItem(config.sessionStorageKey, fileNames);
    } catch {}
  }, [files, config.sessionStorageKey]);

  // For private groups: IDs are required when guests of that type are present
  // Only redirect if we're on the wrong ID type page (e.g., government ID for private group)
  useEffect(() => {
    if (isGroup && isPrivateCategory && step1 && Object.keys(step1).length > 0) {
      const letterOfIntentFile = location.state?.file || null;
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      const governmentIdFiles = location.state?.governmentIdFiles || [];
      
      // Redirect away from government ID upload page (not applicable for private groups)
      if (idType === 'government') {
        // If seniors present, redirect to senior citizen ID upload
        if (hasSeniors) {
          navigate(`/reservation-step3-senior`, {
            state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
          });
        } 
        // If PWDs present, redirect to PWD ID upload
        else if (numberOfGuests > 0) {
          navigate(`/reservation-step3-pwd`, {
            state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
          });
        }
        // Otherwise go to step 4
        else {
          navigate(`/reservation-step4`, {
            state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
          });
        }
      }
      // For senior citizen ID page: redirect to PWD ID if PWDs are present (prioritize PWD over senior)
      // or redirect if no seniors present
      else if (idType === 'senior') {
        // Check for PWDs using the correct key
        const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
        const hasPwds = numberOfPwds > 0;
        // If PWDs present, redirect to PWD ID upload (prioritize PWD over senior)
        if (hasPwds) {
          navigate(`/reservation-step3-pwd`, {
            state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
          });
        }
        // If no seniors present, redirect based on what's available
        else if (!hasSeniors) {
          // Otherwise go to step 4
          navigate(`/reservation-step4`, {
            state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
          });
        }
        // If has seniors and no PWDs, stay on senior citizen ID page (no redirect)
      }
      // For PWD ID page: only redirect if no PWDs present
      else if (idType === 'pwd') {
        // Check for PWDs using the correct key for PWD ID type
        const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
        const hasPwds = numberOfPwds > 0;
        if (!hasPwds) {
          // If no PWDs present, redirect based on what's available
          // If seniors present, redirect to senior citizen ID upload
          if (hasSeniors) {
            navigate(`/reservation-step3-senior`, {
              state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
            });
          }
          // Otherwise go to step 4
          else {
            navigate(`/reservation-step4`, {
              state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
            });
          }
        }
        // If PWDs are present, stay on PWD ID page (no redirect)
      }
    }
  }, [idType, isGroup, isPrivateCategory, hasSeniors, numberOfGuests, step1, step2, navigate, location.state, reservationId, isEdit, userEmail, originalType, typeChangedToGroup]);
  
  // Redirect gov+indiv away from PWD and senior citizen ID upload pages to government ID upload
  useEffect(() => {
    if ((idType === 'pwd' || idType === 'senior') && isGovernmentCategory && isIndividual && step1 && Object.keys(step1).length > 0) {
      const letterOfIntentFile = location.state?.file || null;
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      const governmentIdFiles = location.state?.governmentIdFiles || [];
      
      // Redirect to government ID upload
      navigate(`/reservation-step3-government`, {
        state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
      });
    }
  }, [idType, isGovernmentCategory, isIndividual, step1, step2, navigate, location.state, reservationId, isEdit, userEmail, originalType, typeChangedToGroup]);
  
  // Redirect PWD category+indiv away from government and senior citizen ID upload pages to PWD ID upload
  useEffect(() => {
    if ((idType === 'government' || idType === 'senior') && isPwdCategory && isIndividual && step1 && Object.keys(step1).length > 0) {
      const letterOfIntentFile = location.state?.file || null;
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      const governmentIdFiles = location.state?.governmentIdFiles || [];
      
      // Redirect to PWD ID upload
      navigate(`/reservation-step3-pwd`, {
        state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
      });
    }
  }, [idType, isPwdCategory, isIndividual, step1, step2, navigate, location.state, reservationId, isEdit, userEmail, originalType, typeChangedToGroup]);
  
  // Redirect private+individual away from ID upload pages (except senior citizen ID if seniors present)
  useEffect(() => {
    if (isPrivateAndIndividual && step1 && Object.keys(step1).length > 0) {
      const letterOfIntentFile = location.state?.file || null;
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      const governmentIdFiles = location.state?.governmentIdFiles || [];
      
      // If private+individual with seniors and on government or PWD ID upload page, redirect to senior citizen ID upload
      if (hasSeniors && (idType === 'government' || idType === 'pwd')) {
        navigate(`/reservation-step3-senior`, {
          state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
        });
      } else if (!hasSeniors) {
        // If no seniors, redirect directly to step 4 (review) - no ID needed for private+individual
        navigate(`/reservation-step4`, {
          state: { step1, step2, file: letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
        });
      }
      // If has seniors and on senior citizen ID upload page, stay on that page (don't redirect)
    }
  }, [isPrivateAndIndividual, hasSeniors, idType, step1, step2, navigate, location.state, reservationId, isEdit, userEmail, originalType, typeChangedToGroup]);

  const getCurrentStepFiles = () => {
    if (files.length > 0) return files;
    if (filesRef.current && filesRef.current.length > 0) return filesRef.current;
    return [];
  };

  const handleGoBack = () => {
    // Preserve all files when going back (letter of intent, ID files, etc.)
    const letterOfIntentFile = location.state?.file || null;
    const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
    const pwdIdFiles = location.state?.pwdIdFiles || [];
    const governmentIdFiles = location.state?.governmentIdFiles || [];
    const depedIdFiles = location.state?.depedIdFiles || [];
    const originalStatus = location.state?.originalStatus || null;
    const fromCheckInOut = location.state?.fromCheckInOut || false;
    const activeTab = location.state?.activeTab || null;
    const filters = location.state?.filters || null;
    
    // Get current step's files
    const currentStepFiles = getCurrentStepFiles();
    
    // Build state object, preserving all files including current step's files
    const preservedState = {
      step1, 
      step2, 
      file: letterOfIntentFile,
      seniorCitizenIdFiles,
      pwdIdFiles,
      governmentIdFiles,
      depedIdFiles,
      reservationId, 
      isEdit, 
      userEmail, 
      originalType, 
      typeChangedToGroup,
      originalStatus,
      fromCheckInOut,
      activeTab,
      filters
    };
    
    // Preserve current step's files so they remain when returning to this step later
    preservedState[config.stateKey] = currentStepFiles;
    
    // Navigate back to ResForm2 with all files preserved
    navigate(`/reservation-step2`, { 
      state: preservedState
    });
  };

  const handlePrevious = () => {
    // Clear current step's files when going back
    const isGroup = !!step1?.type?.groups || !!step1?.type?.group;
    const isPrivateCategory = step1?.category?.private === true || step1?.category?.Private === true;
    const isPwdCategory = step1?.category?.pwds === true || step1?.category?.PWDs === true;
    const numberOfSeniors = parseInt(step1?.guests?.senior || 0, 10) || 0;
    const hasSeniors = numberOfSeniors > 0;
    const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
    const hasPwds = numberOfPwds > 0;
    
    // Helper to get preserved files state
    const getPreservedFilesState = (clearCurrentFiles = true) => {
      const letterOfIntentFile = location.state?.file || null;
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      const governmentIdFiles = location.state?.governmentIdFiles || [];
      const depedIdFiles = location.state?.depedIdFiles || [];
      const originalStatus = location.state?.originalStatus || null;
      const fromCheckInOut = location.state?.fromCheckInOut || false;
      const activeTab = location.state?.activeTab || null;
      const filters = location.state?.filters || null;
      
      // Build state object with all files first
      const preservedState = {
        step1,
        step2,
        file: letterOfIntentFile,
        seniorCitizenIdFiles,
        pwdIdFiles,
        governmentIdFiles,
        depedIdFiles,
        reservationId,
        isEdit,
        userEmail,
        originalType,
        typeChangedToGroup,
        originalStatus,
        fromCheckInOut,
        activeTab,
        filters
      };
      
      // Only clear the current step's files after setting all other files
      // This ensures we don't overwrite a file array that was set above
      const currentStepFiles = getCurrentStepFiles();

      if (clearCurrentFiles) {
        preservedState[config.stateKey] = [];
      } else {
        preservedState[config.stateKey] = currentStepFiles;
      }
      
      return preservedState;
    };
    
    if (idType === 'pwd') {
      // For private groups: always go back to Letter of Intent (step 3)
      // Even if seniors are present, we prioritize PWD ID, so we don't show senior citizen ID page
      // This applies to private groups regardless of whether they have PWD category or not
      if (isGroup && isPrivateCategory) {
        navigate(`/reservation-step3`, { 
          state: getPreservedFilesState(false)
        });
        return;
      }
      
      // For PWD category groups: go back to Letter of Intent (step 3)
      // PWD category groups only need PWD ID, not Senior Citizen ID
      if (isGroup && isPwdCategory) {
        navigate(`/reservation-step3`, { 
          state: getPreservedFilesState(false)
        });
        return;
      }
      
      // For non-private, non-PWD category groups: check for seniors first
      // If there are seniors, we should go back to senior citizen step before Letter of Intent
      if (hasSeniors) {
        // Go back to senior citizen ID step (for both group and individual)
        navigate(`/reservation-step3-senior`, { 
          state: getPreservedFilesState(false)
        });
        return;
      }
      
      // No seniors, check if it's a group to go back to Letter of Intent
      if (isGroup) {
        // For group reservations without seniors, go back to Letter of Intent upload step
        navigate(`/reservation-step3`, { 
          state: getPreservedFilesState(false)
        });
        return;
      }
    } else {
      // Senior: Only check for group to go back to Letter of Intent
      if (isGroup) {
        // For group reservations, go back to Letter of Intent upload step
        navigate(`/reservation-step3`, { 
          state: getPreservedFilesState(false)
        });
        return;
      }
    }
    
    // Otherwise return to step 2
    // Preserve files when going back to ResForm2 (parameter false = preserve, not clear)
    navigate(`/reservation-step2`, { 
      state: getPreservedFilesState(false)
    });
  };

  const handleNext = () => {
    // Always use current files state to ensure deletions are preserved
    const currentFiles = files.length > 0 ? files : (filesRef.current.length > 0 ? filesRef.current : []);
    
    if (isRequired && currentFiles.length === 0) {
      setFileError(config.errorMessage);
      return;
    }
    setFileError('');
    
    // Update cache with current files before navigating
    fileCache[cacheKey] = currentFiles;
    filesRef.current = currentFiles;
    
    const letterOfIntentFile = location.state?.file || null;
    const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
    const pwdIdFiles = location.state?.pwdIdFiles || [];
    const governmentIdFiles = location.state?.governmentIdFiles || [];
    
    if (idType === 'senior') {
      const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
      const hasPwds = numberOfPwds > 0;
      
      // For private+individual with seniors: only Senior Citizen ID is needed, go directly to step 4
      // (unless PWDs are also present, then prioritize PWD)
      if (isPrivateAndIndividualWithSeniors && !hasPwds) {
        navigate(`/reservation-step4`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            pwdIdFiles,
            governmentIdFiles,
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      } else if (hasPwds) {
        // If PWDs are present (in any scenario), prioritize PWD ID over senior citizen ID
        // For private groups with PWDs: route to PWD ID upload
        if (isGroup && isPrivateCategory) {
          navigate(`/reservation-step3-pwd`, { 
            state: { 
              step1, 
              step2, 
              file: letterOfIntentFile,
              [config.stateKey]: currentFiles,
              pwdIdFiles,
              governmentIdFiles,
              reservationId,
              isEdit,
              userEmail,
              originalType,
              typeChangedToGroup
            } 
          });
        } else {
          // For non-private groups with PWDs: PWD ID is required
          navigate(`/reservation-step3-pwd`, { 
            state: { 
              step1, 
              step2, 
              file: letterOfIntentFile,
              [config.stateKey]: currentFiles,
              pwdIdFiles,
              governmentIdFiles,
              reservationId,
              isEdit,
              userEmail,
              originalType,
              typeChangedToGroup
            } 
          });
        }
      } else {
        navigate(`/reservation-step4`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            pwdIdFiles,
            governmentIdFiles,
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      }
    } else if (idType === 'government') {
      const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
      const hasPwds = numberOfPwds > 0;
      
      // For government category with individual type: only government ID is needed (no PWD or Senior Citizen ID required) - route directly to step 4
      if (isGovernmentCategoryForThisIdType && isIndividual) {
        navigate(`/reservation-step4`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles,
            depedIdFiles: location.state?.depedIdFiles || [],
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      } else if (hasSeniors) {
        // For government groups with seniors: skip senior citizen ID upload
        // Only government ID is needed - route directly to step 4
        navigate(`/reservation-step4`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles,
            depedIdFiles: location.state?.depedIdFiles || [],
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      } else if (hasPwds) {
        navigate(`/reservation-step3-pwd`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles,
            depedIdFiles: location.state?.depedIdFiles || [],
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      } else {
        navigate(`/reservation-step4`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles,
            depedIdFiles: location.state?.depedIdFiles || [],
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      }
    } else if (idType === 'deped') {
      const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
      const hasPwds = numberOfPwds > 0;
      
      // For DepEd category with individual type: only DepEd ID is needed (no PWD or Senior Citizen ID required) - route directly to step 4
      if (isDepEdCategoryForThisIdType && isIndividual) {
        navigate(`/reservation-step4`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles,
            governmentIdFiles: location.state?.governmentIdFiles || [],
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      } else if (hasSeniors) {
        // For DepEd groups with seniors: skip senior citizen ID upload
        // Only DepEd ID is needed - route directly to step 4
        navigate(`/reservation-step4`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles,
            governmentIdFiles: location.state?.governmentIdFiles || [],
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      } else if (hasPwds) {
        navigate(`/reservation-step3-pwd`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles,
            governmentIdFiles: location.state?.governmentIdFiles || [],
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      } else {
        navigate(`/reservation-step4`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            pwdIdFiles,
            governmentIdFiles: location.state?.governmentIdFiles || [],
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      }
    } else if (idType === 'pwd') {
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const governmentIdFiles = location.state?.governmentIdFiles || [];
      
      // For PWD category with individual type: only PWD ID is needed (no gov't or Senior Citizen ID required) - route directly to step 4
      if (isPwdCategory && isIndividual) {
        navigate(`/reservation-step4`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            governmentIdFiles,
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      } else if (isPwdCategory && hasSeniors) {
        // For PWD category groups with seniors: skip senior citizen ID upload
        // Only PWD ID is needed - route directly to step 4
        navigate(`/reservation-step4`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            [config.stateKey]: currentFiles,
            seniorCitizenIdFiles,
            governmentIdFiles,
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      } else if (isGroup && isPrivateCategory && hasSeniors) {
        // For private groups with seniors: allow optional senior citizen ID upload (already done, go to step 4)
        navigate(`/reservation-step4`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            seniorCitizenIdFiles: location.state?.seniorCitizenIdFiles || [],
            [config.stateKey]: currentFiles,
            governmentIdFiles,
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      } else {
        navigate(`/reservation-step4`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile,
            seniorCitizenIdFiles: location.state?.seniorCitizenIdFiles || [],
            [config.stateKey]: currentFiles,
            governmentIdFiles,
            reservationId,
            isEdit,
            userEmail,
            originalType,
            typeChangedToGroup
          } 
        });
      }
    } else {
      navigate(`/reservation-step4`, { 
        state: { 
          step1, 
          step2, 
          file: letterOfIntentFile,
          seniorCitizenIdFiles: location.state?.seniorCitizenIdFiles || [],
          [config.stateKey]: currentFiles,
          governmentIdFiles,
          reservationId,
          isEdit,
          userEmail,
          originalType,
          typeChangedToGroup
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
          fileCache[cacheKey] = updated;
          return updated;
        });
        // Reset input to allow selecting the same file again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else if (newFiles.length > 0) {
        // Error already set above
        return;
      }
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      filesRef.current = updated;
      fileCache[cacheKey] = updated;
      return updated;
    });
    setFileError('');
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
              aria-label="Go back"
            >
              &larr;
            </span>
            <h1 className={styles.pageTitle}>{config.title}</h1>
          </div>
          <div className={styles.formCard}>
            <div className={styles.formTitle}>
              {config.formTitle}
              {isRequired && <span className={styles.required}>*</span>}
            </div>
            <div className={styles.formSubtitle}>
              → Please upload a clear copy of your {config.subtitle}  {config.description}
            </div>
            <div className={styles.groupNote}>{config.note}</div>
            {isRequired && <div className={styles.groupNote}>{config.mandatoryNote}</div>}
            {idType === 'government' && hasSeniors && (isGroup || isIndividual) && (
              <div className={styles.groupNote} style={{ color: '#0066cc', fontWeight: '500' }}>
                Note: Only one type of discount applies. Since you have selected government category{isIndividual ? ' with individual type' : isGroup ? ' with group type' : ''}, only government ID is required. Senior citizen discount will not apply.
              </div>
            )}
            {idType === 'deped' && hasSeniors && (isGroup || isIndividual) && (
              <div className={styles.groupNote} style={{ color: '#0066cc', fontWeight: '500' }}>
                Note: Only one type of discount applies. Since you have selected DepEd category{isIndividual ? ' with individual type' : isGroup ? ' with group type' : ''}, only DepEd ID is required. Senior citizen discount will not apply.
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
            {isGroup && isPrivateCategory && isRequired && (
              <div className={styles.groupNote} style={{ color: '#0066cc', fontWeight: '500' }}>
                Note: For private group reservations with {config.subtitle.toLowerCase()} guests, {config.subtitle} upload is required along with the Letter of Intent.
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
                    <span>{f.name || (f.url ? `${config.subtitle} (existing)` : config.subtitle)}</span>
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: '#0066cc',
                          textDecoration: 'underline',
                          fontSize: '12px',
                          marginLeft: '4px'
                        }}
                      >
                        View
                      </a>
                    )}
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

// Export wrapper components for backward compatibility
export function PWDReservationForm() {
  return <IDUploadForm idType="pwd" />;
}

export function SeniorCitizenReservationForm() {
  return <IDUploadForm idType="senior" />;
}

export function GovernmentReservationForm() {
  return <IDUploadForm idType="government" />;
}

export function DepEdReservationForm() {
  return <IDUploadForm idType="deped" />;
}

export default IDUploadForm;