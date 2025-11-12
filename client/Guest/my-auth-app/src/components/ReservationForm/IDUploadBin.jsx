import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import styles from './ResForm3.module.css';
import { ArrowLeft, UploadCloud } from 'lucide-react';

// Configuration for different ID types
const ID_TYPE_CONFIG = {
  pwd: {
    title: 'PWD RESERVATION FORM',
    formTitle: 'Upload PWD ID',
    subtitle: 'PWD ID',
    linkText: 'PWD ID Card',
    templateUrl: '#', // TODO: real URL
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
    templateUrl: '#', // TODO: real URL
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
  }
};

function IDUploadForm({ idType = 'pwd' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const config = ID_TYPE_CONFIG[idType] || ID_TYPE_CONFIG.pwd;

  const { type, facilityName, id } = useParams();
  const step1 = location.state?.step1 || {};
  const step2 = location.state?.step2 || {};
  
  // Check if there are guests of this type in the guest count
  const numberOfGuests = parseInt(step1?.guests?.[config.guestKey] || 0, 10) || 0;
  const isRequired = numberOfGuests > 0;

  // ID files should be independent from other files
  const [files, setFiles] = useState(() => {
    // Initialize from location.state
    return location.state?.[config.stateKey] || 
      (location.state?.[config.stateKeySingular] ? [location.state[config.stateKeySingular]] : []);
  });
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef();
  const prevLocationStateRef = useRef(location.state);

  // Update files when location.state changes (e.g., when navigating back with files)
  useEffect(() => {
    // Check if location.state has actually changed
    if (prevLocationStateRef.current === location.state) {
      return; // No change, skip update
    }
    prevLocationStateRef.current = location.state;

    const stateFiles = location.state?.[config.stateKey] || 
      (location.state?.[config.stateKeySingular] ? [location.state[config.stateKeySingular]] : []);
    
    // Get current file names
    const currentFileNames = files.map(f => f.name).sort().join(',');
    const stateFileNames = stateFiles && stateFiles.length > 0 
      ? stateFiles.map(f => f.name).sort().join(',') 
      : '';
    
    // Update if location.state has files and they're different from current files
    // This preserves files when navigating back
    if (stateFiles && stateFiles.length > 0 && currentFileNames !== stateFileNames) {
      setFiles(stateFiles);
    }
    // If location.state doesn't have files, keep current files (don't clear them)
  }, [location.state, config.stateKey, config.stateKeySingular, files]);

  useEffect(() => {
    if (!step1 || !Object.keys(step1).length || !step2 || !Object.keys(step2).length) {
      navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { 
        state: { step1, step2, [config.stateKey]: files } 
      });
    }
  }, [step1, step2, type, facilityName, id, navigate, files, config.stateKey]);

  useEffect(() => {
    try {
      const fileNames = files.map(f => f.name).join(', ');
      sessionStorage.setItem(config.sessionStorageKey, fileNames);
    } catch {}
  }, [files, config.sessionStorageKey]);

  const handleGoBack = () => {
    navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { 
      state: { step1, step2, [config.stateKey]: files } 
    });
  };

  const handlePrevious = () => {
    const routeType = String(type || '').toLowerCase();
    const isGroup = routeType === 'group' || !!step1?.type?.groups || !!step1?.type?.group;
    
    if (idType === 'pwd') {
      // PWD: Check for seniors first (regardless of group/individual)
      // If there are seniors, we should go back to senior citizen step before Letter of Intent
      const numberOfSeniors = parseInt(step1?.guests?.senior || 0, 10) || 0;
      const hasSeniors = numberOfSeniors > 0;
      
      if (hasSeniors) {
        // Go back to senior citizen ID step (for both group and individual)
        navigate(`/reservation-step3-senior/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: location.state?.file, // Preserve Letter of Intent if group
            seniorCitizenIdFiles: location.state?.seniorCitizenIdFiles || [],
            [config.stateKey]: files 
          } 
        });
        return;
      }
      
      // No seniors, check if it's a group to go back to Letter of Intent
      if (isGroup) {
        // For group reservations without seniors, go back to Letter of Intent upload step
        navigate(`/reservation-step3/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: location.state?.file, 
            seniorCitizenIdFiles: location.state?.seniorCitizenIdFiles || [],
            [config.stateKey]: files 
          } 
        });
        return;
      }
    } else {
      // Senior: Only check for group to go back to Letter of Intent
      if (isGroup) {
        // For group reservations, go back to Letter of Intent upload step
        // Preserve PWD files from location.state if they exist
        const pwdIdFiles = location.state?.pwdIdFiles || [];
        navigate(`/reservation-step3/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: location.state?.file, 
            [config.stateKey]: files, // Senior Citizen ID files
            pwdIdFiles // Preserve PWD files
          } 
        });
        return;
      }
    }
    
    // Otherwise return to step 2
    navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { 
      state: { step1, step2, [config.stateKey]: files } 
    });
  };

  const handleNext = () => {
    if (isRequired && files.length === 0) {
      setFileError(config.errorMessage);
      return;
    }
    setFileError('');
    
    const letterOfIntentFile = location.state?.file || null; // From step3 if group
    
    if (idType === 'senior') {
      // Senior: Check if there are PWDs - if yes, route to PWD ID upload next
      const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
      const hasPwds = numberOfPwds > 0;
      
      // Preserve PWD files from location.state if they exist
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      
      if (hasPwds) {
        // Route to PWD ID upload
        navigate(`/reservation-step3-pwd/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile, // Letter of Intent file
            [config.stateKey]: files, // Senior Citizen ID files (array)
            pwdIdFiles // Preserve existing PWD files
          } 
        });
      } else {
        // No PWDs, go directly to final step
        navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
          state: { 
            step1, 
            step2, 
            file: letterOfIntentFile, // Letter of Intent file
            [config.stateKey]: files, // Senior Citizen ID files (array)
            pwdIdFiles // Preserve existing PWD files (should be empty if no PWDs)
          } 
        });
      }
    } else {
      // PWD: Always go to final step
      navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
        state: { 
          step1, 
          step2, 
          file: letterOfIntentFile, // Letter of Intent file
          seniorCitizenIdFiles: location.state?.seniorCitizenIdFiles || [], // Senior Citizen ID files (array)
          [config.stateKey]: files // PWD ID files (array)
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
        setFiles(prev => [...prev, ...validFiles]);
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
    setFiles(prev => prev.filter((_, i) => i !== index));
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

// Export wrapper components for backward compatibility
export function PWDReservationForm() {
  return <IDUploadForm idType="pwd" />;
}

export function SeniorCitizenReservationForm() {
  return <IDUploadForm idType="senior" />;
}

export default IDUploadForm;

