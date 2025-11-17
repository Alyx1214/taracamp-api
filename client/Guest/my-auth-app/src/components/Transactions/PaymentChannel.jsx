import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import styles from './PaymentChannel.module.css';

const PaymentChannel = ({ channel, onClose, onSubmit, reservationId, amount }) => {
  const [referenceNumber, setReferenceNumber] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [extractedReferenceNumber, setExtractedReferenceNumber] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [mismatchWarning, setMismatchWarning] = useState(null);
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

  // Extract reference number from image using OCR
  const extractReferenceNumberFromImage = async (imageFile) => {
    try {
      setIsExtracting(true);
      const worker = await createWorker('eng');
      
      // Configure worker for better text recognition
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ',
      });
      
      const { data: { text } } = await worker.recognize(imageFile);
      await worker.terminate();
      
      // Normalize text for better matching
      const normalizedText = text.toUpperCase();
      
      // Exclude account number patterns (like phone numbers, account numbers)
      const excludePatterns = [
        /\b0\d{10}\b/, // Phone numbers like 09123456789
        /\b\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // Account numbers with dashes
        /ACCOUNT\s*(?:NUMBER|NO|#)[\s:]*[\d-]+/i,
        /ACCOUNT\s*NAME/i,
      ];
      
      // Check if text contains account number patterns and exclude those lines
      const lines = normalizedText.split('\n');
      const filteredLines = lines.filter(line => {
        return !excludePatterns.some(pattern => pattern.test(line));
      });
      const filteredText = filteredLines.join('\n');
      
      // Try to find reference/confirmation number patterns
      // Priority order: confirmation > reference > transaction > txn
      const patterns = [
        // Confirmation number patterns (highest priority)
        /(?:CONFIRMATION|CONF|CONFIRM)\s*(?:NUMBER|NO|#|ID)?[\s:]*([A-Z0-9-]{6,})/i,
        /(?:CONFIRMATION|CONF)\s*:?\s*([A-Z0-9-]{6,})/i,
        
        // Reference number patterns
        /(?:REFERENCE|REF)\s*(?:NUMBER|NO|#|ID)?[\s:]*([A-Z0-9-]{6,})/i,
        /(?:REFERENCE|REF)\s*:?\s*([A-Z0-9-]{6,})/i,
        /REF\s*#?\s*:?\s*([A-Z0-9-]{6,})/i,
        
        // Transaction ID patterns
        /(?:TRANSACTION|TXN)\s*(?:ID|NUMBER|NO|#)?[\s:]*([A-Z0-9-]{6,})/i,
        /(?:TRANSACTION|TXN)\s*:?\s*([A-Z0-9-]{6,})/i,
        
        // Payment reference patterns
        /(?:PAYMENT|PAY)\s*(?:REFERENCE|REF|ID|NUMBER|NO|#)?[\s:]*([A-Z0-9-]{6,})/i,
        
        // Generic patterns (but exclude if looks like account number)
        /\b([A-Z]{2,4}\d{6,})\b/, // Pattern like "GC12345678", "TXN123456"
        /\b(\d{10,})\b/, // Long numeric strings (10+ digits, but not phone numbers)
      ];
      
      let extractedRef = null;
      for (const pattern of patterns) {
        const match = filteredText.match(pattern);
        if (match && match[1]) {
          const candidate = match[1].trim().toUpperCase();
          
          // Additional validation: exclude if it looks like an account number
          const isAccountNumber = 
            /^0\d{10}$/.test(candidate) || // Phone number format
            /^\d{4}[- ]?\d{4}[- ]?\d{4}$/.test(candidate) || // Account number format
            candidate.length < 6; // Too short
          
          if (!isAccountNumber) {
            extractedRef = candidate;
            break;
          }
        }
      }
      
      // If no pattern matched, try to find alphanumeric strings but exclude account numbers
      if (!extractedRef) {
        const words = filteredText.split(/\s+/);
        const candidates = words
          .filter(w => {
            const cleaned = w.replace(/[^A-Z0-9-]/g, '');
            // Must be 6+ chars, not a phone number, not an account number format
            return cleaned.length >= 6 && 
                   !/^0\d{10}$/.test(cleaned) &&
                   !/^\d{4}[- ]?\d{4}[- ]?\d{4}$/.test(cleaned);
          })
          .map(w => w.replace(/[^A-Z0-9-]/g, ''))
          .sort((a, b) => b.length - a.length);
        
        if (candidates.length > 0) {
          extractedRef = candidates[0].trim().toUpperCase();
        }
      }
      
      return extractedRef;
    } catch (err) {
      console.warn('OCR extraction failed:', err);
      return null;
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileChange = async (e) => {
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
      setMismatchWarning(null);
      setExtractedReferenceNumber(null);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Extract reference number from image using OCR
      const extracted = await extractReferenceNumberFromImage(file);
      if (extracted) {
        setExtractedReferenceNumber(extracted);
        
        // Auto-fill the reference number field if it's empty
        if (!referenceNumber || !referenceNumber.trim()) {
          setReferenceNumber(extracted);
        } else {
          // Check if it matches the entered reference number
          const entered = referenceNumber.trim().toUpperCase();
          const extractedUpper = extracted.toUpperCase();
          
          // Normalize both for comparison (remove spaces, dashes, etc.)
          const normalize = (str) => str.replace(/[\s-]/g, '');
          const normalizedEntered = normalize(entered);
          const normalizedExtracted = normalize(extractedUpper);
          
          if (normalizedEntered !== normalizedExtracted) {
            setMismatchWarning(
              `⚠️ Warning: The reference number in your image (${extracted}) doesn't match what you entered (${entered}). Please verify before submitting.`
            );
          } else {
            // Clear warning if they match
            setMismatchWarning(null);
          }
        }
      }
    }
  };

  // Check for mismatch when reference number changes
  const handleReferenceNumberChange = (e) => {
    const value = e.target.value;
    setReferenceNumber(value);
    setError('');
    
    // Check mismatch if we have extracted reference number
    if (extractedReferenceNumber && value.trim()) {
      const entered = value.trim().toUpperCase();
      const extractedUpper = extractedReferenceNumber.toUpperCase();
      
      const normalize = (str) => str.replace(/[\s-]/g, '');
      const normalizedEntered = normalize(entered);
      const normalizedExtracted = normalize(extractedUpper);
      
      if (normalizedEntered !== normalizedExtracted) {
        setMismatchWarning(
          `⚠️ Warning: The reference number in your image (${extractedReferenceNumber}) doesn't match what you entered (${entered}). Please verify before submitting.`
        );
      } else {
        setMismatchWarning(null);
      }
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
        amount: amount || 0,
        referenceNumber: referenceNumber.trim(),
        proofOfPayment: uploadedImage,
        reservationId,
        ocrExtractedReferenceNumber: extractedReferenceNumber || null,
      });
      
      // Modal will be closed by parent on success
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
                onChange={handleReferenceNumberChange}
                className={styles.formInput}
                placeholder="Enter transaction reference number"
                disabled={submitting}
              />
              {isExtracting && (
                <p className={styles.extractingText}>🔍 Extracting reference number from image...</p>
              )}
              {extractedReferenceNumber && !mismatchWarning && (
                <p className={styles.extractedText}>
                  ✓ Found reference number in image: <strong>{extractedReferenceNumber}</strong>
                </p>
              )}
              {mismatchWarning && (
                <div className={styles.warningBox}>
                  <p className={styles.warningText}>{mismatchWarning}</p>
                </div>
              )}
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

            {mismatchWarning && (
              <div className={styles.warningBox}>
                <p className={styles.warningText}>{mismatchWarning}</p>
                <p className={styles.warningHint}>You can still submit, but please verify the reference number is correct.</p>
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