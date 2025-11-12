import React, { useRef, useState } from 'react';
import styles from './NotificationUpload.module.css';

const uploadFields = {
  group: [
    {
      label: 'Upload Memorandum of Agreement',
      description: (
        <>
          Download this <a href="#" className={styles.link}>Memorandum of Agreement Template</a> and upload in the following submission bin.
        </>
      ),
      accept: '.pdf,.doc,.docx',
      key: 'moa',
    },
    {
      label: 'Upload Service Contract',
      accept: '.pdf,.doc,.docx',
      key: 'service',
    },
  ],
  deped: [
    {
      label: 'Upload Memorandum of Agreement',
      description: (
        <>
          Download this <a href="#" className={styles.link}>Memorandum of Agreement Template</a> and upload in the following submission bin.
        </>
      ),
      accept: '.pdf,.doc,.docx',
      key: 'moa',
    },
    {
      label: 'Upload Certificate of Availability of Funds',
      accept: '.pdf,.doc,.docx',
      key: 'funds',
    },
  ],
  gov: [
    {
      label: 'Upload Service Contract',
      accept: '.pdf,.doc,.docx',
      key: 'service',
    },
    {
      label: 'Upload Certificate of Availability of Funds',
      accept: '.pdf,.doc,.docx',
      key: 'funds',
    },
  ],
  'priva-group': [
    {
      label: 'Upload Service Contract',
      accept: '.pdf,.doc,.docx',
      key: 'service',
    },
    {
      label: 'Upload Certificate of Availability of Funds',
      accept: '.pdf,.doc,.docx',
      key: 'funds',
    },
  ],
  individual: [
    {
      label: 'Upload Valid ID (optional)',
      accept: '.pdf,.jpg,.jpeg,.png',
      key: 'id',
    },
  ],
};

export default function NotificationUpload({ clientType = 'group', onSubmit, onBack = () => {} }) {
  const fields = uploadFields[clientType] || uploadFields['group'];
  const fileRefs = useRef({});
  const [selectedFiles, setSelectedFiles] = useState({});

  const handleFileClick = (key) => {
    fileRefs.current[key]?.click();
  };

  const handleFileChange = (key, e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFiles(prev => ({
      ...prev,
      [key]: file
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const files = {};
    fields.forEach(f => {
      const file = fileRefs.current[f.key]?.files?.[0] || selectedFiles[f.key] || null;
      files[f.key] = file;
    });
    
    // Validate that at least one file is selected for group uploads
    // User can upload either MOA or Service Contract (or both)
    if (clientType === 'group') {
      const hasMoa = files.moa !== null;
      const hasServiceContract = files.service !== null;
      if (!hasMoa && !hasServiceContract) {
        alert('Please upload at least one document (Memorandum of Agreement or Service Contract).');
        return;
      }
    }
    
    if (onSubmit) onSubmit(files);
  };

  return (
    <div className={styles.uploadContainer}>
      <div className={styles.headerRow}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back">&#8592;</button>
        <span className={styles.headerTitle}>Notifications</span>
      </div>
      <div className={styles.contentBox}>
        <div className={styles.titleBox}>
          <span>Congratulations, Camper! Confirmation Successful — your reservation is now confirmed. We can't wait to welcome you!</span>
        </div>
        <div className={styles.bodyText}>
          Thank you for choosing Teachers' Camp! Your reservation has been confirmed. We're excited to welcome you and ensure you have a comfortable and memorable stay.
        </div>
        <div className={styles.noticeText}>
          Please ensure to download and upload the necessary documents before your arrival to avoid conflict on your reservation.
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.uploadsContainer}>
            {fields.map((f) => (
              <div className={styles.uploadField} key={f.key}>
                <div className={styles.uploadLabel}>{f.label}</div>
                {f.description && <div className={styles.uploadDesc}>{f.description}</div>}
                <div className={styles.uploadInputRow}>
                  <input
                    type="file"
                    accept={f.accept}
                    ref={el => (fileRefs.current[f.key] = el)}
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileChange(f.key, e)}
                  />
                  <div
                    className={styles.uploadInput}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleFileClick(f.key)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleFileClick(f.key)}
                    aria-label={`Upload ${f.label}`}
                  >
                    {selectedFiles[f.key] ? selectedFiles[f.key].name : 'Click to upload'}
                  </div>
                  <button type="button" className={styles.uploadIconBtn} onClick={() => handleFileClick(f.key)} aria-label="Browse">
                    <span className={styles.uploadIcon}>&#8682;</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="submit" className={styles.submitBtn}>Submit</button>
        </form>
        <div className={styles.footerText}>Looking forward to seeing you soon!</div>
        <div className={styles.metaRow}>
          <span className={styles.metaSource}>Teachers' Camp</span>
          <span className={styles.metaTime}>30mins</span>
        </div>
      </div>
    </div>
  );
}
