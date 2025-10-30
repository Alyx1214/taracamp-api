import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import styles from './ResForm3.module.css';
import { ArrowLeft, UploadCloud } from 'lucide-react';

const SENIOR_CITIZEN_ID_TEMPLATE_URL = '#'; // TODO: real URL

function SeniorCitizenReservationForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const { type, facilityName, id } = useParams();
  const step1 = location.state?.step1 || {};
  const step2 = location.state?.step2 || {};
  // Check if there are senior citizens in the guest count
  const numberOfSeniors = parseInt(step1?.guests?.senior || 0, 10) || 0;
  const isSeniorCitizen = numberOfSeniors > 0;

  // Senior Citizen ID file should be independent from the Letter of Intent
  const [file, setFile] = useState(location.state?.seniorCitizenIdFile || null);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef();

  useEffect(() => {
    if (!step1 || !Object.keys(step1).length || !step2 || !Object.keys(step2).length) {
      navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { state: { step1, step2, file } });
    }
  }, [step1, step2, type, facilityName, id, navigate]);

  useEffect(() => {
    try {
      sessionStorage.setItem('seniorCitizen.step3.fileName', file?.name || '');
    } catch {}
  }, [file]);

  const handleGoBack = () => {
    navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { state: { step1, step2, file } });
  };

  const handlePrevious = () => {
    const routeType = String(type || '').toLowerCase();
    const isGroup = routeType === 'group' || !!step1?.type?.groups || !!step1?.type?.group;
    if (isGroup) {
      // For group reservations, go back to Letter of Intent upload step
      navigate(`/reservation-step3/${type}/${facilityName}/${id}`, { state: { step1, step2, file } });
      return;
    }
    // Otherwise return to step 2
    navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { state: { step1, step2, file } });
  };

  const handleNext = () => {
    if (isSeniorCitizen && !file) {
      setFileError('Senior Citizen ID is required.');
      return;
    }
    setFileError('');
    // Pass both files: letterOfIntentFile (if exists) and seniorCitizenIdFile
    const letterOfIntentFile = location.state?.file || null; // From step3 if group
    navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { 
      state: { 
        step1, 
        step2, 
        file: letterOfIntentFile, // Letter of Intent file
        seniorCitizenIdFile: file // Senior Citizen ID file
      } 
    });
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
          'image/jpeg',
          'image/png',
          'image/jpg'
        ].includes(f.type) || /\.(pdf|docx?|jpe?g|png)$/i.test(f.name);

      if (!okType) {
        setFileError('Please upload a PDF, Word document, or image file (JPG, PNG).');
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
      <HeaderHome />
      <div className={styles.reservationFormContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.headerSection}>
            <button onClick={handleGoBack} className={styles.backButton}>
              <ArrowLeft size={24} />
            </button>
            <h1 className={styles.pageTitle}>SENIOR CITIZEN RESERVATION FORM</h1>
          </div>
          <div className={styles.formCard}>
            <div className={styles.formTitle}>Upload Senior Citizen ID<span className={styles.requiredAsterisk}>*</span></div>
            <div className={styles.formSubtitle}>
              → Please upload a clear copy of your Senior Citizen ID or{' '}
              <a href={SENIOR_CITIZEN_ID_TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className={styles.letterLink}>
                Senior Citizen Discount Card
              </a>{' '}
              to verify your eligibility for senior citizen benefits and discounts.
            </div>
            <div className={styles.groupNote}>This section is required for senior citizen reservations.</div>
            {isSeniorCitizen && <div className={styles.groupNote}>Valid senior citizen identification is mandatory for processing your reservation.</div>}
            <div className={styles.uploadBox} onClick={handleBoxClick} role="button" tabIndex={0}>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <UploadCloud className={styles.uploadIcon} />
              <div className={styles.uploadText}>{file ? file.name : 'Click to upload Senior Citizen ID'}</div>
            </div>
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
                disabled={isSeniorCitizen && !file}
                title={isSeniorCitizen && !file ? 'Upload your Senior Citizen ID to continue.' : undefined}
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

export default SeniorCitizenReservationForm;