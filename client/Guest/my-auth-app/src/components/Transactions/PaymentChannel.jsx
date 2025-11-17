import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import styles from './PaymentChannel.module.css';
import PaymentConfirmation from './PaymentConfirmation';

const PaymentChannel = ({ channel, onClose, onSubmit, reservationId, amount }) => {
  const [referenceNumber, setReferenceNumber] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [extractedReferenceNumber, setExtractedReferenceNumber] = useState(null);
  const [extractedAmount, setExtractedAmount] = useState(null);
  const [extractedPaymentCount, setExtractedPaymentCount] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [mismatchWarning, setMismatchWarning] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submittedPaymentDetails, setSubmittedPaymentDetails] = useState(null);
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

  // Extract reference number from OCR text (helper function)
  const extractReferenceNumberFromText = (text) => {
    try {
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
      
      // Strategy 1: Find "Ref No." (or OCR variations like "R N") and capture ALL digits that follow
      // OCR often reads "REF NO" as "R N" - handle both cases
      let extractedRef = null;
      
      // Find the position of "Ref No." or "R N" in the full text (not just lines)
      // OCR variations: "REF NO", "R N", "REF NO.", "REFERENCE NO", etc.
      const refNoPattern = /(?:REF\s*NO\.?|REFERENCE\s*NO\.?|REF\s*NUMBER|R\s*N\.?|R\s*N\s*)\s*:?\s*/i;
      const refNoMatch = filteredText.match(refNoPattern);
      
      if (refNoMatch) {
        // Get everything after "Ref No." (could span multiple lines)
        const afterRefNo = filteredText.substring(refNoMatch.index + refNoMatch[0].length);
        
        // Extract ALL digits from the next 300 characters (should cover multi-line ref numbers)
        // Look for a sequence of digits that might be split with spaces
        const nextSection = afterRefNo.substring(0, 300);
        
        // Try to find all digit sequences and combine them
        // Match patterns like "0024 569 140287" or "0024569140287"
        // Stop before date/time patterns (like "J 11 2025" or "624 PM")
        
        // Look for date/time indicators to know when to stop
        const dateTimePattern = /(?:[A-Z]\s+\d+\s+\d+|PM|AM|\d{1,2}:\d{2})/i;
        const dateTimeMatch = nextSection.match(dateTimePattern);
        const stopIndex = dateTimeMatch ? dateTimeMatch.index : nextSection.length;
        const beforeDateTime = nextSection.substring(0, stopIndex);
        
        // Extract digit sequences only from the part before date/time
        const relevantDigitSequences = beforeDateTime.match(/\d+/g) || [];
        
        // Combine all digit sequences (they might be split with spaces)
        // Filter out very short sequences (1-2 digits) that are likely not part of ref number
        const significantDigits = relevantDigitSequences.filter(seq => seq.length >= 3);
        let allDigits = significantDigits.join('');
        
        // If we didn't get enough digits, try including shorter sequences too
        if (allDigits.length < 8) {
          allDigits = relevantDigitSequences.join('');
        }
        
        // Limit to 15 digits max (typical ref number length, prevents including date)
        allDigits = allDigits.substring(0, 15);
        
        // If we found digits, validate and use them
        if (allDigits.length >= 8 && !/^0\d{10}$/.test(allDigits)) {
          extractedRef = allDigits;
        } else {
          // Fallback: just extract all digits from the section before date/time
          allDigits = beforeDateTime.replace(/[^\d]/g, '').substring(0, 15);
          if (allDigits.length >= 8 && !/^0\d{10}$/.test(allDigits)) {
            extractedRef = allDigits;
          }
        }
      }
      
      // Strategy 1.5: Look for pattern "R N" followed by digits (OCR variation)
      // Stop before date/time patterns (like "J 11 2025" or "624 PM")
      if (!extractedRef) {
        const rnPattern = /\bR\s*N\s+((?:\d+\s*)+?)(?:\s*[A-Z]\s+\d+\s+\d+|PM|AM|\d{1,2}:\d{2})/i;
        let rnMatch = filteredText.match(rnPattern);
        
        // If that didn't match, try without date constraint
        if (!rnMatch) {
          rnMatch = filteredText.match(/\bR\s*N\s+(\d+(?:\s+\d+){2,4})/i);
        }
        
        if (rnMatch && rnMatch[1]) {
          // Extract digits and limit to reasonable length (ref numbers are usually 10-15 digits)
          const digits = rnMatch[1].replace(/\s+/g, '');
          // Limit to 15 digits max (typical ref number length)
          const limitedDigits = digits.substring(0, 15);
          if (limitedDigits.length >= 8 && !/^0\d{10}$/.test(limitedDigits)) {
            extractedRef = limitedDigits;
          }
        }
      }
      
      // Strategy 2: Look for line containing "R N" followed by digits (OCR often reads "REF NO" as "R N")
      // Stop before date/time patterns
      if (!extractedRef) {
        for (let i = 0; i < filteredLines.length; i++) {
          const line = filteredLines[i];
          // Look for "R N" pattern (OCR variation of "REF NO")
          // Stop before date/time indicators like "J 11 2025" or "624 PM"
          const rnMatch = line.match(/\bR\s*N\s+((?:\d+\s*)+?)(?:\s*[A-Z]\s+\d+\s+\d+|PM|AM|\d{1,2}:\d{2})/i);
          if (rnMatch && rnMatch[1]) {
            const digits = rnMatch[1].replace(/\s+/g, '').substring(0, 15);
            if (digits.length >= 8 && !/^0\d{10}$/.test(digits)) {
              extractedRef = digits;
              break;
            }
          }
          
          // Fallback: try without date constraint but limit length
          if (!extractedRef) {
            const rnMatch2 = line.match(/\bR\s*N\s+(\d+(?:\s+\d+){2,4})/i);
            if (rnMatch2 && rnMatch2[1]) {
              const digits = rnMatch2[1].replace(/\s+/g, '').substring(0, 15);
              if (digits.length >= 8 && !/^0\d{10}$/.test(digits)) {
                extractedRef = digits;
                break;
              }
            }
          }
        }
      }
      
      // Strategy 3: Line-by-line approach if Strategy 1-2 didn't work
      if (!extractedRef) {
        for (let i = 0; i < filteredLines.length; i++) {
          const line = filteredLines[i];
          const refNoMatch = line.match(/(?:REF\s*NO\.?|REFERENCE\s*NO\.?|REF\s*NUMBER|R\s*N\.?)\s*:?\s*/i);
          
          if (refNoMatch) {
            // Get all digits from this line after "Ref No."
            const afterRefNo = line.substring(refNoMatch.index + refNoMatch[0].length);
            let allDigits = afterRefNo.replace(/[^\d]/g, '');
            
            // Also check next 2-3 lines for more digits (in case it's split across lines)
            // Look for lines that contain mostly digits
            for (let j = i + 1; j < Math.min(i + 4, filteredLines.length); j++) {
              const nextLine = filteredLines[j];
              // If next line is mostly digits or has digit groups, add them
              const nextLineDigits = nextLine.replace(/[^\d]/g, '');
              // Only add if it looks like part of a reference number (3+ digits)
              if (nextLineDigits.length >= 3) {
                allDigits += nextLineDigits;
              } else {
                // Stop if we hit a line that's clearly not part of the reference number
                break;
              }
            }
            
            if (allDigits.length >= 8 && !/^0\d{10}$/.test(allDigits)) {
              extractedRef = allDigits.substring(0, 15); // Limit to reasonable length
              break;
            }
          }
        }
      }
      
      // Strategy 4: Try regex patterns for other formats
      if (!extractedRef) {
        const patterns = [
          // Reference number patterns with "Ref No." prefix (handle spaces)
          /(?:REF\s*NO\.?|REFERENCE\s*NO\.?|REF\s*NUMBER)\s*:?\s*([0-9\s]{10,})/i,
          
          // Confirmation number patterns
          /(?:CONFIRMATION|CONF|CONFIRM)\s*(?:NUMBER|NO|#|ID)?[\s:]*([A-Z0-9-\s]{6,})/i,
          /(?:CONFIRMATION|CONF)\s*:?\s*([A-Z0-9-\s]{6,})/i,
          
          // Reference number patterns (handle spaces)
          /(?:REFERENCE|REF)\s*(?:NUMBER|NO|#|ID)?[\s:]*([A-Z0-9-\s]{6,})/i,
          /(?:REFERENCE|REF)\s*:?\s*([A-Z0-9-\s]{6,})/i,
          /REF\s*#?\s*:?\s*([A-Z0-9-\s]{6,})/i,
          
          // Transaction ID patterns
          /(?:TRANSACTION|TXN)\s*(?:ID|NUMBER|NO|#)?[\s:]*([A-Z0-9-\s]{6,})/i,
          /(?:TRANSACTION|TXN)\s*:?\s*([A-Z0-9-\s]{6,})/i,
          
          // Payment reference patterns
          /(?:PAYMENT|PAY)\s*(?:REFERENCE|REF|ID|NUMBER|NO|#)?[\s:]*([A-Z0-9-\s]{6,})/i,
          
          // Generic patterns (but exclude if looks like account number)
          /\b([A-Z]{2,4}\d{6,})\b/, // Pattern like "GC12345678", "TXN123456"
          /\b(\d{10,})\b/, // Long numeric strings (10+ digits, but not phone numbers)
        ];
        
        for (const pattern of patterns) {
          const match = filteredText.match(pattern);
          if (match && match[1]) {
            // Remove spaces from the extracted reference number
            let candidate = match[1].trim().replace(/\s+/g, '').toUpperCase();
            
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
      }
      
      // If still no match, try to find alphanumeric strings but exclude account numbers
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
      console.warn('Reference number extraction failed:', err);
      return null;
    }
  };

  // Extract reference number from image using OCR (wrapper for backward compatibility)
  const extractReferenceNumberFromImage = async (imageFile) => {
    try {
      setIsExtracting(true);
      const worker = await createWorker('eng');
      
      // Configure worker for better text recognition (include currency symbols and decimals)
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- .,₱$PHP',
      });
      
      const { data: { text } } = await worker.recognize(imageFile);
      await worker.terminate();
      
      return extractReferenceNumberFromText(text);
    } catch (err) {
      console.warn('OCR extraction failed:', err);
      return null;
    } finally {
      setIsExtracting(false);
    }
  };

  // Extract payment amount from image using OCR
  const extractAmountFromImage = (text) => {
    try {
      const normalizedText = text.toUpperCase();
      
      // Patterns to find payment amounts
      // Look for currency symbols followed by numbers, or "AMOUNT", "TOTAL", "PAID", etc.
      const amountPatterns = [
        // Currency symbol patterns: ₱1,234.56, PHP 1,234.56, $1,234.56
        /[₱$]?\s*PHP\s*:?\s*([\d,]+\.?\d*)/i,
        /[₱$]\s*([\d,]+\.?\d*)/,
        /(?:AMOUNT|TOTAL|PAID|PAYMENT)\s*(?:AMOUNT|AMT)?\s*:?\s*[₱$]?\s*PHP\s*:?\s*([\d,]+\.?\d*)/i,
        /(?:AMOUNT|TOTAL|PAID|PAYMENT)\s*(?:AMOUNT|AMT)?\s*:?\s*[₱$]\s*([\d,]+\.?\d*)/i,
        // Number with comma/period separators (likely currency)
        /\b([\d]{1,3}(?:[,\s][\d]{3})*(?:\.[\d]{2})?)\b/,
      ];

      let extractedAmount = null;
      const amounts = [];

      for (const pattern of amountPatterns) {
        const matches = normalizedText.matchAll(new RegExp(pattern.source, 'gi'));
        for (const match of matches) {
          if (match[1]) {
            // Clean the amount: remove commas and spaces, keep decimal
            const cleaned = match[1].replace(/[,\s]/g, '');
            const numValue = parseFloat(cleaned);
            
            // Validate: reasonable payment amount (between 1 and 1,000,000)
            if (!isNaN(numValue) && numValue >= 1 && numValue <= 1000000) {
              amounts.push(numValue);
            }
          }
        }
      }

      // If multiple amounts found, prefer the largest one (usually the total)
      if (amounts.length > 0) {
        // Sort descending and take the largest
        amounts.sort((a, b) => b - a);
        extractedAmount = amounts[0];
      }

      return extractedAmount;
    } catch (err) {
      console.warn('Amount extraction failed:', err);
      return null;
    }
  };

  // Count how many payment items/transactions are in the receipt
  const countPaymentsFromImage = (text) => {
    try {
      const normalizedText = text.toUpperCase();
      
      // Look for indicators of multiple payments:
      // - Multiple "PAID" or "PAYMENT" keywords
      // - Multiple reference numbers
      // - Itemized lists with amounts
      // - Transaction count indicators
      
      const paymentIndicators = [
        /(?:PAID|PAYMENT|TRANSACTION|TXN)\s*(?:NO|NUMBER|#|ID)/gi,
        /(?:REF\s*NO|REFERENCE\s*NUMBER|REF\s*#)/gi,
        /ITEM\s*\d+/gi,
      ];

      let maxCount = 0;
      
      for (const pattern of paymentIndicators) {
        const matches = normalizedText.matchAll(pattern);
        let count = 0;
        for (const _ of matches) {
          count++;
        }
        maxCount = Math.max(maxCount, count);
      }

      // Also look for numbered items (Item 1, Item 2, etc.)
      const itemMatches = normalizedText.matchAll(/ITEM\s*(\d+)/gi);
      const itemNumbers = [];
      for (const match of itemMatches) {
        if (match[1]) {
          itemNumbers.push(parseInt(match[1], 10));
        }
      }
      if (itemNumbers.length > 0) {
        maxCount = Math.max(maxCount, Math.max(...itemNumbers));
      }

      // If we found indicators, return the count (minimum 1 if any indicators found)
      return maxCount > 0 ? maxCount : null;
    } catch (err) {
      console.warn('Payment count extraction failed:', err);
      return null;
    }
  };

  // Enhanced extraction function that gets reference number, amount, and payment count
  const extractPaymentInfoFromImage = async (imageFile) => {
    try {
      setIsExtracting(true);
      const worker = await createWorker('eng');
      
      // Configure worker for better text recognition (include currency symbols and decimals)
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- .,₱$PHP',
      });
      
      const { data: { text } } = await worker.recognize(imageFile);
      await worker.terminate();
      
      // Extract reference number from text
      const extractedRef = extractReferenceNumberFromText(text);
      
      // Extract amount
      const extractedAmt = extractAmountFromImage(text);
      
      // Count payments
      const paymentCount = countPaymentsFromImage(text);
      
      return {
        referenceNumber: extractedRef,
        amount: extractedAmt,
        paymentCount: paymentCount,
      };
    } catch (err) {
      console.warn('OCR extraction failed:', err);
      return {
        referenceNumber: null,
        amount: null,
        paymentCount: null,
      };
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
      setExtractedAmount(null);
      setExtractedPaymentCount(null);
      
      // Clear reference number when new image is uploaded
      setReferenceNumber('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Extract payment info from image using OCR (reference number, amount, payment count)
      const extractedInfo = await extractPaymentInfoFromImage(file);
      if (extractedInfo) {
        if (extractedInfo.referenceNumber) {
          setExtractedReferenceNumber(extractedInfo.referenceNumber);
          // Auto-fill the reference number field with extracted value
          setReferenceNumber(extractedInfo.referenceNumber);
        }
        if (extractedInfo.amount) {
          setExtractedAmount(extractedInfo.amount);
        }
        if (extractedInfo.paymentCount) {
          setExtractedPaymentCount(extractedInfo.paymentCount);
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
      
      // Store payment details for confirmation display
      const channelNames = {
        gcash: 'GCash',
        grab_pay: 'GrabPay',
        dbp: 'Development Bank of the Philippines'
      };
      
      setSubmittedPaymentDetails({
        channel: channelNames[channel] || channel,
        referenceNumber: referenceNumber.trim(),
        amount: amount
      });
      
      // Show confirmation overlay
      setShowConfirmation(true);
    } catch (err) {
      setError(err?.message || 'Failed to submit payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmationDone = () => {
    setShowConfirmation(false);
    onClose(); // Close the payment channel modal
  };

  const handleViewTransaction = () => {
    setShowConfirmation(false);
    onClose(); // Close the payment channel modal
    // You can add navigation to transaction page here
    // For example: navigate('/transactions');
    window.location.href = '/transactions'; // Simple redirect
  };

  if (showConfirmation) {
    return (
      <PaymentConfirmation
        onDone={handleConfirmationDone}
        onViewTransaction={handleViewTransaction}
        paymentDetails={submittedPaymentDetails}
      />
    );
  }

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
                <p className={styles.extractingText}>🔍 Extracting payment information from image...</p>
              )}
              {extractedReferenceNumber && !mismatchWarning && (
                <p className={styles.extractedText}>
                  ✓ Found reference number in image: <strong>{extractedReferenceNumber}</strong>
                </p>
              )}
              {extractedAmount && (
                <p className={styles.extractedText}>
                  💰 Detected amount: <strong>₱{extractedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                </p>
              )}
              {extractedPaymentCount && extractedPaymentCount > 1 && (
                <p className={styles.extractedText}>
                  📊 Found <strong>{extractedPaymentCount}</strong> payment item(s) in receipt
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