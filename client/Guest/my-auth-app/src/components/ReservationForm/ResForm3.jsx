import React, { useRef, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import styles from './ResForm3.module.css';
import { ArrowLeft, UploadCloud } from 'lucide-react';

const LETTER_TEMPLATE_URL = '#'; // Replace with actual template link

function ReservationFormStep3() {
  const navigate = useNavigate();
  const location = useLocation();
  const { type, id } = useParams();
  const formDataFromStep2 = location.state?.formData || {};
  const [file, setFile] = useState(null);
  const fileInputRef = useRef();

  const handleGoBack = () => {
    navigate(-1);
  };

  const handlePrevious = () => {
    navigate(-1);
  };

  const handleNext = () => {
    // Combine all form data and file, then navigate to next step or submit
    const combinedFormData = { ...formDataFromStep2, letterOfIntent: file };
    console.log('Combined Form Data:', combinedFormData);
    // Navigate to next step or submit
    // navigate('/reservation-step4', { state: { formData: combinedFormData } });
    navigate(`/reservation-step4/${type}/${id}`, { state: { formData: combinedFormData } });
  };

  const handleBoxClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
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
            <div className={styles.formTitle}>Upload Letter of Intent</div>
            <div className={styles.formSubtitle}>
              → Download this{' '}
              <a
                href={LETTER_TEMPLATE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.letterLink}
              >
                Letter of Intent Template
              </a>{' '}
              for your reference and make sure that your Uploaded Letter of Intent covers all the information needed.
            </div>
            <div className={styles.groupNote}>
              This section is only for group reservation.
            </div>
            <div className={styles.uploadBox} onClick={handleBoxClick}>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <UploadCloud className={styles.uploadIcon} />
              <div className={styles.uploadText}>
                {file ? file.name : 'Click to upload'}
              </div>
            </div>
            <div className={styles.infoText}>
              Kindly double check the following information before submitting.
            </div>
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
