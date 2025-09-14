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

  const [file, setFile] = useState(location.state?.file || null);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef();

  useEffect(() => {
    if (!step1 || !Object.keys(step1).length || !step2 || !Object.keys(step2).length) {
      navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { state: { step1, step2, file } });;
    }
  }, [step1, step2, type, id, navigate]);

    useEffect(() => {
      try {
        sessionStorage.setItem('reservation.step3.fileName', file?.name || '');
      } catch {}
    }, [file]);

  const handleGoBack = () => {
    navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { state: { step1, step2, file } });
  };

  const handlePrevious = () => {
    navigate(`/reservation-step2/${type}/${facilityName}/${id}`, { state: { step1, step2, file } });
  };

  const handleNext = () => {
    if (!file) {
      setFileError('Letter of Intent is required.');
      return;
    }
    setFileError('');
    navigate(`/reservation-step4/${type}/${facilityName}/${id}`, { state: { step1, step2, file } });
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
            <div className={styles.uploadBox} onClick={handleBoxClick} role="button" tabIndex={0}>
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
            {fileError && <div className={styles.fieldError} style={{ marginTop: 8 }}>{fileError}</div>}

            <div className={styles.infoText}>Kindly double check the following information before submitting.</div>
            <div className={styles.buttonContainer}>
              <button type="button" onClick={handlePrevious} className={styles.previousButton}>
                Previous
              </button>
              <button type="button" onClick={handleNext} className={styles.nextButton}>
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
