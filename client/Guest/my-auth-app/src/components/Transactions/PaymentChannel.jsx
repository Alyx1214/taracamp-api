import React, { useState, useRef } from 'react';
import styles from './PaymentChannel.module.css';

const PaymentChannel = ({ channel, onClose, onSubmit, reservationId }) => {
  const [referenceNumber, setReferenceNumber] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Payment channel details
  const channelDetails = {
    gcash: {
      name: 'GCash',
      accountName: 'Teachers Camp',
      accountNumber: '09123456789',
      qrCode: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/QR_code_for_mobile_English_Wikipedia.svg/1200px-QR_code_for_mobile_English_Wikipedia.svg.png',
      instructions: 'Scan the QR code using your GCash app or send to the account number below.'
    },
    grab_pay: {
      name: 'GrabPay',
      accountName: 'Teachers Camp',
      accountNumber: '09987654321',
      qrCode: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/QR_code_for_mobile_English_Wikipedia.svg/1200px-QR_code_for_mobile_English_Wikipedia.svg.png',
      instructions: 'Scan the QR code using your GrabPay app or send to the account number below.'
    },
    dbp: {
      name: 'Development Bank of the Philippines',
      accountName: 'Teachers Camp',
      accountNumber: '1234-5678-9012',
      qrCode: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/QR_code_for_mobile_English_Wikipedia.svg/1200px-QR_code_for_mobile_English_Wikipedia.svg.png',
      instructions: 'Scan the QR code using your banking app or transfer to the account number below.'
    }
  };

  const details = channelDetails[channel] || channelDetails.gcash;

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      setUploadedImage(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!referenceNumber.trim()) {
      setError('Please enter a reference number');
      return;
    }

    if (!uploadedImage) {
      setError('Please upload a proof of payment');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Call the parent's onSubmit with the payment data
      await onSubmit({
        channel,
        referenceNumber: referenceNumber.trim(),
        proofOfPayment: uploadedImage,
        reservationId
      });
      
      // Close modal on success
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to submit payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.paymentChannelModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Pay with {details.name}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.modalContent}>
          {/* Instructions */}
          <div className={styles.instructionsBox}>
            <p className={styles.instructionsText}>{details.instructions}</p>
          </div>

          {/* QR Code and Account Details */}
          <div className={styles.paymentDetailsSection}>
            <div className={styles.qrCodeContainer}>
              <img src={details.qrCode} alt={`${details.name} QR Code`} className={styles.qrCodeImage} />
              <p className={styles.qrLabel}>Scan to Pay</p>
            </div>

            <div className={styles.accountDetailsContainer}>
              <div className={styles.accountDetailRow}>
                <span className={styles.accountLabel}>Account Name:</span>
                <span className={styles.accountValue}>{details.accountName}</span>
              </div>
              <div className={styles.accountDetailRow}>
                <span className={styles.accountLabel}>Account Number:</span>
                <span className={styles.accountValue}>{details.accountNumber}</span>
              </div>
            </div>
          </div>

          {/* Upload and Reference Form */}
          <form onSubmit={handleSubmit} className={styles.paymentForm}>
            <div className={styles.formGroup}>
              <label htmlFor="referenceNumber" className={styles.formLabel}>
                Reference Number <span className={styles.required}>*</span>
              </label>
              <input
                id="referenceNumber"
                type="text"
                value={referenceNumber}
                onChange={(e) => {
                  setReferenceNumber(e.target.value);
                  setError('');
                }}
                className={styles.formInput}
                placeholder="Enter transaction reference number"
                disabled={submitting}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Proof of Payment <span className={styles.required}>*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              
              {!imagePreview ? (
                <div
                  className={styles.uploadArea}
                  onClick={handleFileClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleFileClick()}
                >
                  <p className={styles.uploadText}>Click to upload screenshot or receipt</p>
                  <p className={styles.uploadHint}>Supported: JPG, PNG, PDF (Max 5MB)</p>
                </div>
              ) : (
                <div className={styles.imagePreviewContainer}>
                  <img src={imagePreview} alt="Payment proof" className={styles.imagePreview} />
                  <button
                    type="button"
                    className={styles.changeImageButton}
                    onClick={handleFileClick}
                    disabled={submitting}
                  >
                    Change Image
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className={styles.errorMessage}>
                {error}
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={submitting || !referenceNumber.trim() || !uploadedImage}
              >
                {submitting ? 'Submitting...' : 'Submit Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PaymentChannel;