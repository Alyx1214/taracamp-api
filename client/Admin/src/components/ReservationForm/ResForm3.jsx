import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './ResForm3.module.css';
import { UploadCloud } from 'lucide-react';

const LETTER_TEMPLATE_URL = '#';

function ReservationFormStep3() {
  const navigate = useNavigate();
  const location = useLocation();

  const step1 = location.state?.step1 || {};
  const step2 = location.state?.step2 || {};
  const isGroup = step1?.type?.groups || false;
  const originalType = location.state?.originalType || null;
  const typeChangedToGroup = location.state?.typeChangedToGroup || false;

  const [file, setFile] = useState(() => {
    return location.state?.file || null;
  });
  const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
  const pwdIdFiles = location.state?.pwdIdFiles || [];
  const governmentIdFiles = location.state?.governmentIdFiles || [];
  const reservationId = location.state?.reservationId || null;
  const isEdit = location.state?.isEdit || false;
  const userEmail = location.state?.userEmail || null;
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef();
  const prevLocationStateRef = useRef(location.state);

  // Update file when location.state changes (e.g., when navigating back with file)
  useEffect(() => {
    const stateFile = location.state?.file;
    if (stateFile) {
      setFile(stateFile);
    }
    prevLocationStateRef.current = location.state;
  }, [location.state]);

  useEffect(() => {
    if (!step1 || !Object.keys(step1).length || !step2 || !Object.keys(step2).length) {
      navigate(`/reservation-step2`, { state: { step1, step2, file } });
    }
    // Redirect individuals directly to Step 4 since they don't need letter of intent
    if (!isGroup) {
      navigate(`/reservation-step4`, { state: { step1, step2, file } });
    }
  }, [step1, step2, navigate, isGroup]);

  useEffect(() => {
    try {
      sessionStorage.setItem('reservation.step3.fileName', file?.name || '');
    } catch {}
  }, [file]);

  const handleGoBack = () => {
    navigate(`/reservation-step2`, { state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup } });
  };

  const handlePrevious = () => {
    navigate(`/reservation-step2`, { state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup } });
  };

  const handleNext = () => {
    // Require Letter of Intent for groups, especially if type changed from individual to group
    if (isGroup && !file) {
      if (typeChangedToGroup) {
        setFileError('Letter of Intent is required. Since you changed the reservation type from Individual to Group, please upload a Letter of Intent.');
      } else {
        setFileError('Letter of Intent is required.');
      }
      return;
    }
    setFileError('');
    
    const numberOfSeniors = parseInt(step1?.guests?.senior || 0, 10) || 0;
    const numberOfPwds = parseInt(step1?.guests?.pwds || 0, 10) || 0;
    const hasSeniors = numberOfSeniors > 0;
    const hasPwds = numberOfPwds > 0;
    
    // Check category
    const isGovernmentCategory = step1?.category?.government === true || step1?.category?.deped === true;
    const isPwdCategory = step1?.category?.pwds === true || step1?.category?.PWDs === true;
    const isPrivateCategory = step1?.category?.private === true || step1?.category?.Private === true;
    
    // Preserve files from location.state if they exist
    const seniorCitizenIdFiles = location.state?.seniorCitizenIdFiles || [];
    const pwdIdFiles = location.state?.pwdIdFiles || [];
    const governmentIdFiles = location.state?.governmentIdFiles || [];
    
    // For gov't/deped groups: route to government ID upload (even if seniors present)
    // Senior citizen ID will be skipped - only gov't/deped ID is needed
    if (isGroup && isGovernmentCategory) {
      navigate(`/reservation-step3-government`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
      });
      return;
    }
    
    // For PWD groups: route to PWD ID upload (even if seniors present)
    // Senior citizen ID will be skipped - only PWD ID is needed
    if (isGroup && isPwdCategory) {
      navigate(`/reservation-step3-pwd`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
      });
      return;
    }
    
    // For private groups: check if seniors are present
    if (isGroup && isPrivateCategory) {
      if (hasSeniors) {
        // Private group with seniors: Letter of Intent → Senior Citizen ID
        navigate(`/reservation-step3-senior`, { 
          state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
        });
      } else {
        // Private group without seniors: only Letter of Intent is required
        navigate(`/reservation-step4`, { 
          state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup } 
        });
      }
      return;
    }
    
    // For other groups with seniors: route to senior citizen ID upload
    if (hasSeniors) {
      navigate(`/reservation-step3-senior`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
      });
    } else if (hasPwds) {
      navigate(`/reservation-step3-pwd`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup }
      });
    } else {
      navigate(`/reservation-step4`, { 
        state: { step1, step2, file, seniorCitizenIdFiles, pwdIdFiles, governmentIdFiles, reservationId, isEdit, userEmail, originalType, typeChangedToGroup } 
      });
    }
  };

  const handleBoxClick = () => {
    fileInputRef.current?.click();
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
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setFileError('File is too large. Max 5 MB.');
        return;
      }

      setFileError('');
      setFile(f);
    }
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
            <h1 className={styles.pageTitle}>RESERVATION FORM</h1>
          </div>
          <div className={styles.formCard}>
            <div className={styles.formTitle}>Upload Letter of Intent<span className={styles.required}>*</span></div>
            <div className={styles.formSubtitle}>
              → Download this{' '}
              <a href={LETTER_TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className={styles.letterLink}>
                Letter of Intent Template
              </a>{' '}
              for your reference and make sure your uploaded file covers all required information.
            </div>
            <div className={styles.groupNote}>This section is required for group reservations.</div>
            {typeChangedToGroup && (
              <div className={styles.groupNote} style={{ color: '#0066cc', fontWeight: '500', marginTop: '8px' }}>
                Note: You have changed the reservation type from Individual to Group. A Letter of Intent is now required.
              </div>
            )}
            <div className={styles.uploadBox} onClick={handleBoxClick} role="button" tabIndex={0}>
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <UploadCloud className={styles.uploadIcon} />
              <div className={styles.uploadText}>
                {file ? (file.name || (file.url ? 'Letter of Intent (existing)' : 'Letter of Intent')) : 'Click to upload'}
              </div>
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
                  <span>{file.name || (file.url ? 'Letter of Intent (existing)' : 'Letter of Intent')}</span>
                  {file.url && (
                    <a
                      href={file.url}
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
                  {file.url && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
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
                  )}
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
                disabled={!file}
                title={!file ? 'Upload the Letter of Intent to continue.' : undefined}
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