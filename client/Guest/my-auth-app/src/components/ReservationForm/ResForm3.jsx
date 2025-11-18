import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import styles from './ResForm3.module.css';
import { ArrowLeft, UploadCloud } from 'lucide-react';

const LETTER_TEMPLATE_URL = '#'; // TODO: real URL

function ReservationFormStep3() {
  const navigate = useNavigate();
  const location = useLocation();

  const { type, facilityName, id } = useParams();
  const step1 = location.state?.step1 || {};
  const step2 = location.state?.step2 || {};
  const routeType = String(type || '').toLowerCase();
  const isGroup = routeType === 'group' || !!step1?.type?.groups || !!step1?.type?.group;
  const numberOfSeniors = parseInt(step1?.guests?.senior || 0, 10) || 0;
  const hasSeniors = numberOfSeniors > 0;

  const [file, setFile] = useState(location.state?.file || null);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef();
  const prevLocationStateRef = useRef(location.state);

  // Update file when location.state changes (e.g., when navigating back with files)
  useEffect(() => {
    // Check if location.state has actually changed
    if (prevLocationStateRef.current === location.state) {
      return; // No change, skip update
    }
    prevLocationStateRef.current = location.state;

    // Only update from location.state if it has a file and it's different from current
    // This preserves files when navigating back
    if (location.state?.file) {
      const currentFileName = file?.name || '';
      const stateFileName = location.state.file?.name || '';
      if (currentFileName !== stateFileName) {
        setFile(location.state.file);
      }
    }
    // If location.state doesn't have a file, keep current file (don't clear it)
  }, [location.state, file]);

  useEffect(() => {
    if (!step1 || !Object.keys(step1).length || !step2 || !Object.keys(step2).length) {
      // Preserve files when navigating back
      const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
      const pwdIdFiles = location.state?.pwdIdFiles || [];
      navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles } 
      });
    }
  }, [step1, step2, type, facilityName, id, navigate, file, location.state]);

    useEffect(() => {
      try {
        sessionStorage.setItem('reservation.step3.fileName', file?.name || '');
      } catch {}
    }, [file]);

  const handleGoBack = () => {
    // Preserve files from location.state if they exist
    const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
    const pwdIdFiles = location.state?.pwdIdFiles || [];
    navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { 
      state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles } 
    });
  };

  const handlePrevious = () => {
    // Preserve files from location.state if they exist
    const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
    const pwdIdFiles = location.state?.pwdIdFiles || [];
    navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { 
      state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles } 
    });
  };

  const handleNext = () => {
    if (isGroup && !file) {
      setFileError('Letter of Intent is required.');
      return;
    }
    setFileError('');
    
    const categoryObj = step1?.category || {};
    const isGovernmentCategory = categoryObj.government === true || 
                                  categoryObj.Government === true ||
                                  (typeof categoryObj === 'object' && Object.keys(categoryObj).some(key => 
                                    key.toLowerCase() === 'government' && categoryObj[key] === true
                                  ));
    const isDepEdCategory = categoryObj.deped === true ||
                            categoryObj.DepEd === true ||
                            (typeof categoryObj === 'object' && Object.keys(categoryObj).some(key => 
                              key.toLowerCase() === 'deped' && categoryObj[key] === true
                            ));
    const isPwdCategory = categoryObj.pwds === true || 
                          categoryObj.PWDs === true ||
                          (typeof categoryObj === 'object' && Object.keys(categoryObj).some(key => 
                            key.toLowerCase() === 'pwds' && categoryObj[key] === true
                          ));
    const isPrivateCategory = categoryObj.private === true || 
                              categoryObj.Private === true ||
                              (typeof categoryObj === 'object' && Object.keys(categoryObj).some(key => 
                                key.toLowerCase() === 'private' && categoryObj[key] === true
                              ));
    
    const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
    const hasPwds = numberOfPwds > 0;
    
    const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
    const pwdIdFiles = location.state?.pwdIdFiles || [];
    const governmentIdFiles = location.state?.governmentIdFiles || [];
    const depedIdFiles = location.state?.depedIdFiles || [];
    
    // For DepEd groups: route to DepEd ID upload (even if seniors present)
    // Senior citizen ID will be skipped - only DepEd ID is needed
    if (isGroup && isDepEdCategory) {
      navigate(`/reservation-step3-deped/${type}/${facilityName}/${id}`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, depedIdFiles }
      });
      return;
    }
    
    // For government groups: route to government ID upload (even if seniors present)
    // Senior citizen ID will be skipped - only government ID is needed
    if (isGroup && isGovernmentCategory) {
      navigate(`/reservation-step3-government/${type}/${facilityName}/${id}`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, depedIdFiles }
      });
      return;
    }
    
    // For PWD groups: route to PWD ID upload (even if seniors present)
    // Senior citizen ID will be skipped - only PWD ID is needed
    if (isGroup && isPwdCategory) {
      navigate(`/reservation-step3-pwd/${type}/${facilityName}/${id}`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles }
      });
      return;
    }
    
    // For private groups: Letter of Intent is required, but allow optional ID uploads if seniors or PWDs are present
    // Priority: PWD ID over Senior Citizen ID (if both are present, only PWD ID should appear)
    if (isGroup && isPrivateCategory) {
      // If PWDs are present, route to PWD ID upload (optional) - prioritize PWD over senior
      if (hasPwds) {
        navigate(`/reservation-step3-pwd/${type}/${facilityName}/${id}`, { 
          state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles }
        });
        return;
      }
      // If seniors are present (and no PWDs), route to senior citizen ID upload (optional)
      if (hasSeniors) {
        navigate(`/reservation-step3-senior/${type}/${facilityName}/${id}`, { 
          state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles }
        });
        return;
      }
      // If no seniors or PWDs, go directly to step 4
      navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles } 
      });
      return;
    }
    
    // For other groups with seniors: route to senior citizen ID upload
    if (hasSeniors) {
      navigate(`/reservation-step3-senior/${type}/${facilityName}/${id}`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles }
      });
    } else if (hasPwds) {
      navigate(`/reservation-step3-pwd/${type}/${facilityName}/${id}`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles }
      });
    } else {
      navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles } 
      });
    }
  };


  const handleBoxClick = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = e => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];

      const okType =
        [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ].includes(f.type) || /\.(pdf|docx?)$/i.test(f.name);

      if (!okType) {
        setFileError('Please upload a PDF or Word document.');
        // Reset input to allow selecting again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setFileError('File is too large. Max 5 MB.');
        // Reset input to allow selecting again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setFileError('');
      setFile(f);
      // Reset input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileError('');
    // Reset input to allow selecting again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
          <div className={styles.formCard}>
            <div className={styles.formTitle}>Upload Letter of Intent<span className={styles.requiredAsterisk}>*</span></div>
            <div className={styles.formSubtitle}>
              → Download this{' '}
              <a href={LETTER_TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className={styles.letterLink}>
                Letter of Intent Template
              </a>{' '}
              for your reference and make sure your uploaded file covers all required information.
            </div>
            <div className={styles.groupNote}>This section is only for group reservations.</div>
            {isGroup && <div className={styles.groupNote}>This section is required for group reservations.</div>}
            <div 
              className={styles.uploadBox} 
              onClick={handleBoxClick} 
              onKeyDown={handleKeyDown}
              role="button" 
              tabIndex={0}
            >
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <UploadCloud className={styles.uploadIcon} />
              <div className={styles.uploadText}>{file ? file.name : 'Click to upload'}</div>
            </div>
            {file && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <div
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
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
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
                disabled={isGroup && !file}
                title={isGroup && !file ? 'Upload the Letter of Intent to continue.' : undefined}
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

export default ReservationFormStep3;
