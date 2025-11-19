import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createWorker } from 'tesseract.js';
import styles from "./PaymentDetails.module.css";
import { getPaymentDetails, updatePaymentStatus, uploadInvoice } from "../../apis/paymentApi"; 

export default function PaymentDetails() {
  const { id: reservationId } = useParams();
  const navigate = useNavigate();

  // Get user role to check permissions
  const role = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';
  const canEditPayment = role === 'ACCOUNTING';

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [payment, setPayment] = React.useState(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  
  // Form states
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [invoiceFile, setInvoiceFile] = React.useState(null);
  const [invoicePreview, setInvoicePreview] = React.useState(null);
  const [paymentStatus, setPaymentStatus] = React.useState("");
  const [updateError, setUpdateError] = React.useState("");
  const [updateSuccess, setUpdateSuccess] = React.useState("");
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [extractedInvoiceNumber, setExtractedInvoiceNumber] = React.useState(null);

  // Excess charges states - only counts, rates come from facility
  const [excessWithBeddings, setExcessWithBeddings] = React.useState(0);
  const [excessWithoutBeddings, setExcessWithoutBeddings] = React.useState(0);
  const [excessCapacity, setExcessCapacity] = React.useState(0); // For event/conference reservations

  const fileInputRef = React.useRef(null);

  // Check if the reservation is for event or event and lodging (uses conference halls)
  const isEventReservation = payment?.serviceType === "Event" || 
                            payment?.serviceType === "Event and Lodging";
  
  // Check if facility is Cottage (only Cottage has excess with/without beddings)
  const isCottage = payment?.facilityType === "Cottage";

  // Extract invoice number from OCR text
  const extractInvoiceNumberFromText = (text) => {
    try {
      // Fix common OCR errors first (but be careful not to corrupt numbers)
      let correctedText = text
        // Fix common character misreadings in text (not in numbers)
        .replace(/AUNTABLE/gi, 'ACCOUNTABLE')
        .replace(/A(?:CC|C)0UNTABLE/gi, 'ACCOUNTABLE')
        .replace(/A(?:CC|C)0UNTS/gi, 'ACCOUNTS')
        // Fix NO patterns but preserve numbers
        .replace(/\bN0\b/g, 'NO') // N0 -> NO (word boundary to avoid changing numbers)
        .replace(/Nº/g, 'NO') // Nº -> NO
        .replace(/N°/g, 'NO') // N° -> NO
        .replace(/\bN\s*O\b/g, 'NO'); // N O -> NO
      
      // Normalize text for better matching
      const normalizedText = correctedText.toUpperCase();
      
      // Exclude account number patterns (like phone numbers, account numbers)
      const excludePatterns = [
        /\b0\d{10}\b/, // Phone numbers like 09123456789
        /\b\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // Account numbers with dashes
        /ACCOUNT\s*(?:NUMBER|NO|#)[\s:]*[\d-]+/i,
        /ACCOUNT\s*NAME/i,
        /ACCOUNT\s*CODE/i,
      ];
      
      // Check if text contains account number patterns and exclude those lines
      const lines = normalizedText.split('\n');
      const filteredLines = lines.filter(line => {
        return !excludePatterns.some(pattern => pattern.test(line));
      });
      const filteredText = filteredLines.join('\n');
      
      let extractedInvoice = null;
      
      // Strategy 1: Find "Official Receipt No." or "Receipt No." patterns (most common for receipts)
      // Look for patterns like "Nº 0005906" or "NO 0005906" or "RECEIPT NO 0005906"
      const receiptPatterns = [
        // Pattern: Nº, NO, N0, N° followed by digits (with optional spaces)
        /\bN[O0º°]\s+([0-9]{4,})\b/i,
        // Pattern: OFFICIAL RECEIPT NO followed by digits
        /(?:OFFICIAL\s*RECEIPT|RECEIPT)\s*(?:NO\.?|NUMBER|#|Nº|N°)\s*:?\s*([0-9]{4,})/i,
        // Pattern: RECEIPT/INVOICE # followed by digits
        /(?:RECEIPT|INVOICE)\s*#?\s*:?\s*([0-9]{4,})/i,
      ];
      
      for (const pattern of receiptPatterns) {
        const match = filteredText.match(pattern);
        if (match && match[1]) {
          // Extract only the number part
          let candidate = match[1].trim();
          // Keep leading zeros for receipt numbers (they're important)
          // Just ensure it's a valid number sequence
          if (candidate.length >= 4 && /^\d+$/.test(candidate) && !/^0\d{10}$/.test(candidate)) {
            extractedInvoice = candidate;
            break;
          }
        }
      }
      
      // Strategy 1.5: If we found "NO" or "Nº" but didn't capture the number, look right after it
      if (!extractedInvoice) {
        const noPattern = /\bN[O0º°]\s+/i;
        const noMatch = filteredText.match(noPattern);
        if (noMatch) {
          const afterNo = filteredText.substring(noMatch.index + noMatch[0].length);
          // Look for digits immediately after (within 50 chars)
          const nextSection = afterNo.substring(0, 50);
          const digitMatch = nextSection.match(/\b([0-9]{4,})\b/);
          if (digitMatch && digitMatch[1]) {
            const candidate = digitMatch[1].trim();
            if (candidate.length >= 4 && /^\d+$/.test(candidate) && !/^0\d{10}$/.test(candidate)) {
              extractedInvoice = candidate;
            }
          }
        }
      }
      
      // Strategy 2: Find "Invoice No." or "Invoice Number" patterns
      if (!extractedInvoice) {
        const invoicePatterns = [
          /(?:INVOICE\s*NO\.?|INVOICE\s*NUMBER|INV\s*NO\.?|INV\s*#)\s*:?\s*([A-Z0-9-\s]{4,})/i,
          /(?:INVOICE|INV)\s*(?:NUMBER|NO|#|ID)?[\s:]*([A-Z0-9-\s]{4,})/i,
        ];
        
        for (const pattern of invoicePatterns) {
          const match = filteredText.match(pattern);
          if (match) {
            if (match[1]) {
              // Pattern with capture group
              let candidate = match[1].trim().replace(/\s+/g, '').toUpperCase();
              if (candidate.length >= 4 && !/^0\d{10}$/.test(candidate)) {
                extractedInvoice = candidate;
                break;
              }
            } else {
              // Pattern without capture group - get text after match
              const afterMatch = filteredText.substring(match.index + match[0].length);
              const nextSection = afterMatch.substring(0, 100);
              const digits = nextSection.replace(/[^\dA-Z-]/g, '').substring(0, 20);
              if (digits.length >= 4 && !/^0\d{10}$/.test(digits)) {
                extractedInvoice = digits;
                break;
              }
            }
          }
        }
      }
      
      // Strategy 3: Look for common invoice/receipt number formats
      if (!extractedInvoice) {
        const formats = [
          /\b(?:RECEIPT|INV)[- ]?([0-9]{4,})\b/i,
          /\b(?:RECEIPT|INVOICE)[- ]?([0-9]{4,})\b/i,
          /#\s*([0-9]{4,})\b/i,
          /\bNO\.?\s*:?\s*([0-9]{4,})\b/i,
        ];
        
        for (const format of formats) {
          const match = filteredText.match(format);
          if (match && match[1]) {
            let candidate = match[1].trim();
            // Keep leading zeros for receipt numbers
            if (candidate.length >= 4 && /^\d+$/.test(candidate)) {
              extractedInvoice = candidate;
              break;
            }
          }
        }
      }
      
      // Strategy 4: Look for standalone number sequences that look like receipt/invoice numbers
      // (usually 4-10 digits, often with leading zeros)
      if (!extractedInvoice) {
        const numberPatterns = [
          /\b([0-9]{6,10})\b/g, // 6-10 digit numbers (common for receipts)
          /\b([0-9]{4,5})\b/g,  // 4-5 digit numbers (shorter invoice numbers)
        ];
        
        const candidates = [];
        for (const pattern of numberPatterns) {
          let match;
          while ((match = pattern.exec(filteredText)) !== null) {
            const num = match[1];
            // Exclude phone numbers, dates, and account numbers
            if (!/^0\d{10}$/.test(num) && 
                !/^\d{4}[- ]?\d{4}[- ]?\d{4}$/.test(num) &&
                !/^(19|20)\d{2}$/.test(num)) { // Exclude years
              candidates.push(num);
            }
          }
        }
        
        // Sort by length (longer is more likely to be receipt number) and position
        if (candidates.length > 0) {
          // Prefer numbers that appear near "RECEIPT", "INVOICE", "NO", etc.
          const receiptKeywords = /(?:RECEIPT|INVOICE|NO|NUMBER|OFFICIAL)/i;
          const scoredCandidates = candidates.map(candidate => {
            const candidateIndex = filteredText.indexOf(candidate);
            const context = filteredText.substring(Math.max(0, candidateIndex - 50), candidateIndex + 50);
            const score = receiptKeywords.test(context) ? 10 : 1;
            return { candidate, score, length: candidate.length };
          });
          
          scoredCandidates.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return b.length - a.length;
          });
          
          extractedInvoice = scoredCandidates[0].candidate;
        }
      }
      
      return extractedInvoice;
    } catch (err) {
      console.warn('Invoice number extraction failed:', err);
      return null;
    }
  };

  // Extract invoice number from image using OCR
  const extractInvoiceNumberFromImage = async (imageFile) => {
    try {
      setIsExtracting(true);
      const worker = await createWorker('eng');
      
      // Configure worker for better text recognition
      // Include more characters to handle special symbols like º, °, etc.
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- .,#º°|',
        tessedit_pageseg_mode: '6', // Assume uniform block of text
      });
      
      const { data: { text } } = await worker.recognize(imageFile);
      await worker.terminate();
      
      // Extract and return only the invoice/receipt number
      return extractInvoiceNumberFromText(text);
    } catch (err) {
      console.warn('OCR extraction failed:', err);
      return null;
    } finally {
      setIsExtracting(false);
    }
  };

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!reservationId) throw new Error("Missing reservation id");
        setLoading(true);
        setError("");

        const res = await getPaymentDetails(reservationId);
        const data = res?.data?.data ?? res?.data ?? res;

        if (!data || typeof data !== "object") {
          throw new Error(res?.error || "Failed to fetch payment details");
        }

        if (!cancelled) {
          setPayment(data);
          setInvoiceNumber(data.invoiceNumber || "");
          setPaymentStatus(data.paymentStatus || "Unpaid");
          setInvoicePreview(data.invoiceImageUrl || null);
          
          // Load excess counts if available (rates come from facility)
          setExcessWithBeddings(data.excessWithBeddings?.count || 0);
          setExcessWithoutBeddings(data.excessWithoutBeddings?.count || 0);
          setExcessCapacity(data.excessCapacity?.count || 0);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [reservationId]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setUpdateError('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUpdateError('File size must be less than 5MB');
        return;
      }

      setInvoiceFile(file);
      setUpdateError("");
      setExtractedInvoiceNumber(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoicePreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Extract invoice number from image using OCR
      const extracted = await extractInvoiceNumberFromImage(file);
      if (extracted) {
        setExtractedInvoiceNumber(extracted);
        // Auto-fill the invoice number field with extracted value
        setInvoiceNumber(extracted);
      }
    }
  };

  const handleRemoveImage = () => {
    setInvoiceFile(null);
    setInvoicePreview(payment?.invoiceImageUrl || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveChanges = async () => {
    setUpdateError("");
    setUpdateSuccess("");
    
    // Validation
    if (!invoiceNumber.trim()) {
      setUpdateError("Invoice number is required");
      return;
    }
    
    if (!paymentStatus) {
      setUpdateError("Payment status is required");
      return;
    }

    // Validate excess charges
    if (isEventReservation || !isCottage) {
      if (excessCapacity < 0) {
        setUpdateError("Excess capacity count cannot be negative");
        return;
      }
    } else if (isCottage) {
      if (excessWithBeddings < 0 || excessWithoutBeddings < 0) {
        setUpdateError("Excess count cannot be negative");
        return;
      }
    }

    setSaving(true);
    
    try {
      // Upload invoice image if changed
      let invoiceFileId = null;
      let invoiceImageUrl = payment?.invoiceImageUrl;
      if (invoiceFile) {
        const uploadRes = await uploadInvoice(reservationId, invoiceFile);
        if (uploadRes?.data?.invoiceFileId) {
          invoiceFileId = uploadRes.data.invoiceFileId;
          // Use the returned URL for immediate display
          if (uploadRes?.data?.invoiceImageUrl) {
            invoiceImageUrl = uploadRes.data.invoiceImageUrl;
          }
        }
      }

      // Prepare update payload based on service type
      const updatePayload = {
        invoiceNumber: invoiceNumber.trim(),
        paymentStatus,
        invoiceFileId
      };

      if (isEventReservation || !isCottage) {
        updatePayload.excessCapacityCount = parseInt(excessCapacity) || 0;
      } else if (isCottage) {
        updatePayload.excessWithBeddingsCount = parseInt(excessWithBeddings) || 0;
        updatePayload.excessWithoutBeddingsCount = parseInt(excessWithoutBeddings) || 0;
      }

      // Update payment details
      const updateRes = await updatePaymentStatus(reservationId, updatePayload);

      if (updateRes?.status === 200 || updateRes?.success) {
        setUpdateSuccess("Payment details updated successfully. Total estimated amount has been recalculated.");
        
        // Reload payment details to get updated total
        try {
          const res = await getPaymentDetails(reservationId);
          const data = res?.data?.data ?? res?.data ?? res;
          if (data && typeof data === "object") {
            setPayment(data);
            // Update excess state with new values
            setExcessWithBeddings(data.excessWithBeddings?.count || 0);
            setExcessWithoutBeddings(data.excessWithoutBeddings?.count || 0);
            setExcessCapacity(data.excessCapacity?.count || 0);
          }
        } catch (reloadError) {
          console.warn("Failed to reload payment details:", reloadError);
          // Still update local state with what we know
          const updatedPayment = {
            ...payment,
            invoiceNumber: invoiceNumber.trim(),
            paymentStatus,
            invoiceImageUrl: invoiceImageUrl || payment.invoiceImageUrl
          };

          if (isEventReservation || !isCottage) {
            updatedPayment.excessCapacity = {
              count: parseInt(excessCapacity) || 0,
              rate: payment.excessCapacity?.rate || 0
            };
          } else if (isCottage) {
            updatedPayment.excessWithBeddings = {
              count: parseInt(excessWithBeddings) || 0,
              rate: payment.excessWithBeddings?.rate || 0
            };
            updatedPayment.excessWithoutBeddings = {
              count: parseInt(excessWithoutBeddings) || 0,
              rate: payment.excessWithoutBeddings?.rate || 0
            };
          }
          setPayment(updatedPayment);
        }

        setIsEditing(false);
        
        // Clear success message after 5 seconds
        setTimeout(() => setUpdateSuccess(""), 5000);
      } else {
        throw new Error(updateRes?.error || "Failed to update payment details");
      }
    } catch (e) {
      console.error("Error updating payment:", e);
      setUpdateError(e?.message || "Failed to update payment details");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setInvoiceNumber(payment?.invoiceNumber || "");
    setPaymentStatus(payment?.paymentStatus || "Unpaid");
    setInvoiceFile(null);
    setInvoicePreview(payment?.invoiceImageUrl || null);
    setExcessWithBeddings(payment?.excessWithBeddings?.count || 0);
    setExcessWithoutBeddings(payment?.excessWithoutBeddings?.count || 0);
    setExcessCapacity(payment?.excessCapacity?.count || 0);
    setUpdateError("");
    setUpdateSuccess("");
    setExtractedInvoiceNumber(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calculate excess charges total using rates from payment (which come from facility)
  const calculateExcessTotal = () => {
    if (isEventReservation || !isCottage) {
      const capacity = typeof excessCapacity === 'string' && excessCapacity === '' ? 0 : Number(excessCapacity || 0);
      return capacity * Number(payment?.excessCapacity?.rate || 0);
    } else if (isCottage) {
      const withBeddings = typeof excessWithBeddings === 'string' && excessWithBeddings === '' ? 0 : Number(excessWithBeddings || 0);
      const withoutBeddings = typeof excessWithoutBeddings === 'string' && excessWithoutBeddings === '' ? 0 : Number(excessWithoutBeddings || 0);
      const withBeddingsTotal = withBeddings * Number(payment?.excessWithBeddings?.rate || 0);
      const withoutBeddingsTotal = withoutBeddings * Number(payment?.excessWithoutBeddings?.rate || 0);
      return withBeddingsTotal + withoutBeddingsTotal;
    }
    return 0;
  };

  // Calculate total estimated amount including updated excess charges
  const calculateTotalEstimatedAmount = () => {
    if (!payment) return "₱0.00";
    
    // Parse current total amount (remove currency symbol and commas)
    const parseAmount = (amountStr) => {
      if (!amountStr) return 0;
      const cleaned = String(amountStr).replace(/[₱,]/g, '').trim();
      return parseFloat(cleaned) || 0;
    };

    // Get current excess charges from payment
    const isCottage = payment?.facilityType === "Cottage";
    const currentExcessTotal = (isEventReservation || !isCottage)
      ? (payment?.excessCapacity?.count || 0) * (payment?.excessCapacity?.rate || 0)
      : ((payment?.excessWithBeddings?.count || 0) * (payment?.excessWithBeddings?.rate || 0) +
         (payment?.excessWithoutBeddings?.count || 0) * (payment?.excessWithoutBeddings?.rate || 0));

    // Calculate new excess charges based on current state
    const newExcessTotal = calculateExcessTotal();

    // Get current total
    const currentTotal = parseAmount(payment.total);

    // Calculate new total: current total - old excess + new excess
    const newTotal = currentTotal - currentExcessTotal + newExcessTotal;

    // Format as currency
    return `₱${newTotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  // Skeleton Loading Component
  const SkeletonLoading = () => (
    <div className={styles["payment-details-container"]}>
      <div className={styles["payment-details-header"]}>
        <span
          className={styles["add-form-back"]}
          onClick={() => navigate(-1)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate(-1)}
        >
          &larr;
        </span>
        <h1 className={styles["payment-details-title"]}>Payment Details</h1>
      </div>
      <div className={styles["payment-details-card"]}>
        <table className={styles["payment-details-table"]}>
          <tbody>
            {Array.from({ length: 3 }).map((_, index) => (
              <tr key={index}>
                <td className={styles["payment-details-label"]}>
                  <div className={`${styles["skeleton-label"]} ${styles["skeleton"]}`}></div>
                </td>
                <td className={styles["payment-details-separator"]}>
                  <div className={`${styles["skeleton-separator"]} ${styles["skeleton"]}`}></div>
                </td>
                <td>
                  <div className={`${styles["skeleton-value"]} ${styles["skeleton"]}`}></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const Back = (
    <span
      className={styles["add-form-back"]}
      onClick={() => navigate('/transactions?tab=Payment')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate('/transactions?tab=Payment')}
      aria-label="Go back"
    >
      &larr;
    </span>
  );

  if (loading) {
    return <SkeletonLoading />;
  }

  if (error || !payment) {
    return (
      <div className={styles["payment-details-container"]}>
        <div className={styles["payment-details-header"]}>
          {Back}
          <h1 className={styles["payment-details-title"]}>Payment Details</h1>
        </div>
        <div className={styles["payment-details-card"]}>
          <p>{error || "Payment not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["payment-details-container"]}>
      <div className={styles["payment-details-header"]}>
        {Back}
        <h1 className={styles["payment-details-title"]}>Payment Details</h1>
      </div>

      {updateSuccess && (
        <div className={styles["success-message"]}>
          {updateSuccess}
        </div>
      )}

      {updateError && (
        <div className={styles["error-message"]}>
          {updateError}
        </div>
      )}

      <div className={styles["payment-details-card"]}>
        {/* Edit Button - Positioned in upper right corner - Only visible to ACCOUNTING role */}
        {!isEditing && canEditPayment && (
          <button 
            className={styles["edit-button-corner"]}
            onClick={() => setIsEditing(true)}
          >
            Edit Payment Info
          </button>
        )}

        {/* Basic Information */}
        <table className={styles["payment-details-table"]}>
          <tbody>
            <tr>
              <td className={styles["payment-details-label"]}>Reference Number</td>
              <td className={styles["payment-details-separator"]}>:</td>
              <td>{payment.referenceNumber?.toUpperCase()}</td>
            </tr>
            <tr>
              <td className={styles["payment-details-label"]}>Name</td>
              <td className={styles["payment-details-separator"]}>:</td>
              <td>{payment.name}</td>
            </tr>
            <tr>
              <td className={styles["payment-details-label"]}>Confirmation Fee</td>
              <td className={styles["payment-details-separator"]}>:</td>
              <td>{payment.confirmationFee}</td>
            </tr>
          </tbody>
        </table>

        {/* Client's Proof of Payment Section */}
        <hr className={styles["payment-details-divider"]} />
        <div className={styles["payment-details-section-title"]}>Client's Payment Proof</div>
        <table className={styles["payment-details-table"]}>
          <tbody>
            <tr>
              <td className={styles["payment-details-label"]}>Reference Number</td>
              <td className={styles["payment-details-separator"]}>:</td>
              <td>
                {payment.clientReferenceNumber || (
                  <span className={styles["placeholder-text"]}>Not provided</span>
                )}
              </td>
            </tr>
            <tr>
              <td className={styles["payment-details-label"]}>Proof of Payment</td>
              <td className={styles["payment-details-separator"]}>:</td>
              <td>
                {payment.clientProofOfPaymentUrl ? (
                  <a 
                    href={payment.clientProofOfPaymentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles["payment-details-link-highlighted"]}
                  >
                    Click to open
                  </a>
                ) : (
                  <span className={styles["placeholder-text"]}>No image uploaded</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Payment Breakdown */}
        <hr className={styles["payment-details-divider"]} />
        <div className={styles["payment-details-section-title"]}>Payment Breakdown</div>
        <table className={styles["payment-details-table"]}>
          <tbody>
            {payment.breakdown?.map((item, idx) => (
              <tr key={idx}>
                <td className={styles["payment-details-label"]}>{item.label}</td>
                <td className={styles["payment-details-separator"]}>:</td>
                <td>{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Add-ons */}
        {payment.addons && payment.addons.length > 0 && (
          <>
            <hr className={styles["payment-details-divider"]} />
            <div className={styles["payment-details-section-title"]}>Add-ons</div>
            <table className={styles["payment-details-table"]}>
              <tbody>
                {payment.addons.map((addon, idx) => (
                  <tr key={idx}>
                    <td className={styles["payment-details-label"]}>{addon.name}</td>
                    <td className={styles["payment-details-separator"]}>:</td>
                    <td>{addon.price} ({addon.unit})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Excess Charges Section */}
        <hr className={styles["payment-details-divider"]} />
        <div className={styles["payment-details-section-title"]}>
          {isEventReservation || !isCottage ? "Rate per Excess Capacity" : "Rate per Excess"}
        </div>
        
        {isEditing ? (
          <div className={styles["excess-charges-edit"]}>
            {isEventReservation || !isCottage ? (
              // Event/Conference or non-Cottage - Excess Capacity
              <div className={styles["excess-charge-group"]}>
                <h4 className={styles["excess-charge-title"]}>Excess Capacity</h4>
                <div className={styles["excess-charge-inputs"]}>
                  <div className={styles["form-group"]}>
                    <label className={styles["form-label"]}>Number of Excess Attendees</label>
                    <input
                      type="number"
                      className={styles["form-input"]}
                      value={excessCapacity}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow empty string for typing, but convert to 0 if invalid
                        if (value === '' || value === '-') {
                          setExcessCapacity('');
                        } else {
                          const numValue = parseInt(value, 10);
                          if (!isNaN(numValue) && numValue >= 0) {
                            setExcessCapacity(numValue);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // Set to 0 if empty when field loses focus
                        if (e.target.value === '' || e.target.value === '-') {
                          setExcessCapacity(0);
                        }
                      }}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div className={styles["excess-rate-info"]}>
                    Rate per Excess: ₱{(payment?.excessCapacity?.rate || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  </div>
                  <div className={styles["excess-subtotal"]}>
                    Subtotal: ₱{(() => {
                      const capacity = typeof excessCapacity === 'string' && excessCapacity === '' ? 0 : Number(excessCapacity || 0);
                      const rate = Number(payment?.excessCapacity?.rate || 0);
                      const subtotal = capacity * rate;
                      return subtotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                    })()}
                  </div>
                </div>
              </div>
            ) : isCottage ? (
              // Cottage - With/Without Beddings
              <>
                {/* With Beddings */}
                <div className={styles["excess-charge-group"]}>
                  <h4 className={styles["excess-charge-title"]}>Complete Beddings and Toiletries</h4>
                  <div className={styles["excess-charge-inputs"]}>
                    <div className={styles["form-group"]}>
                      <label className={styles["form-label"]}>Number of Excess</label>
                      <input
                        type="number"
                        className={styles["form-input"]}
                        value={excessWithBeddings}
                        onChange={(e) => setExcessWithBeddings(e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div className={styles["excess-rate-info"]}>
                      Rate per Excess: ₱{(payment?.excessWithBeddings?.rate || 0).toFixed(2)}
                    </div>
                    <div className={styles["excess-subtotal"]}>
                      Subtotal: ₱{((excessWithBeddings || 0) * (payment?.excessWithBeddings?.rate || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Without Beddings */}
                <div className={styles["excess-charge-group"]}>
                  <h4 className={styles["excess-charge-title"]}>No Provision of Beddings/Toiletries</h4>
                  <div className={styles["excess-charge-inputs"]}>
                    <div className={styles["form-group"]}>
                      <label className={styles["form-label"]}>Number of Excess</label>
                      <input
                        type="number"
                        className={styles["form-input"]}
                        value={excessWithoutBeddings}
                        onChange={(e) => setExcessWithoutBeddings(e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div className={styles["excess-rate-info"]}>
                      Rate per Excess: ₱{(payment?.excessWithoutBeddings?.rate || 0).toFixed(2)}
                    </div>
                    <div className={styles["excess-subtotal"]}>
                      Subtotal: ₱{((excessWithoutBeddings || 0) * (payment?.excessWithoutBeddings?.rate || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <table className={styles["payment-details-table"]}>
            <tbody>
              {isEventReservation || !isCottage ? (
                // Event/Conference or non-Cottage Display
                payment.excessCapacity?.count > 0 ? (
                  <>
                    <tr>
                      <td className={styles["payment-details-label"]}>Excess Capacity</td>
                      <td className={styles["payment-details-separator"]}>:</td>
                      <td>
                        {payment.excessCapacity.count} × ₱{payment.excessCapacity.rate.toFixed(2)} = 
                        ₱{(payment.excessCapacity.count * payment.excessCapacity.rate).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td className={styles["payment-details-label"]} style={{ fontWeight: 'bold' }}>Total Excess Charges</td>
                      <td className={styles["payment-details-separator"]}>:</td>
                      <td style={{ fontWeight: 'bold' }}>
                        ₱{((payment.excessCapacity?.count || 0) * (payment.excessCapacity?.rate || 0)).toFixed(2)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan="3" className={styles["placeholder-text"]}>No excess capacity charges</td>
                  </tr>
                )
              ) : isCottage ? (
                // Cottage Display
                (payment.excessWithBeddings?.count > 0 || payment.excessWithoutBeddings?.count > 0) ? (
                  <>
                    {payment.excessWithBeddings?.count > 0 && (
                      <tr>
                        <td className={styles["payment-details-label"]}>With Beddings</td>
                        <td className={styles["payment-details-separator"]}>:</td>
                        <td>
                          {payment.excessWithBeddings.count} × ₱{payment.excessWithBeddings.rate.toFixed(2)} = 
                          ₱{(payment.excessWithBeddings.count * payment.excessWithBeddings.rate).toFixed(2)}
                        </td>
                      </tr>
                    )}
                    {payment.excessWithoutBeddings?.count > 0 && (
                      <tr>
                        <td className={styles["payment-details-label"]}>W/O Beddings</td>
                        <td className={styles["payment-details-separator"]}>:</td>
                        <td>
                          {payment.excessWithoutBeddings.count} × ₱{payment.excessWithoutBeddings.rate.toFixed(2)} = 
                          ₱{(payment.excessWithoutBeddings.count * payment.excessWithoutBeddings.rate).toFixed(2)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className={styles["payment-details-label"]} style={{ fontWeight: 'bold' }}>Total Excess Charges</td>
                      <td className={styles["payment-details-separator"]}>:</td>
                      <td style={{ fontWeight: 'bold' }}>
                        ₱{calculateExcessTotal().toFixed(2)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan="3" className={styles["placeholder-text"]}>No excess charges</td>
                  </tr>
                )
              ) : null}
            </tbody>
          </table>
        )}
        
        {/* Service Fee */}
        <hr className={styles["payment-details-divider"]} />
        <div className={styles["payment-details-section-title"]}>Service Fee</div>
        <table className={styles["payment-details-table"]}>
          <tbody>
            <tr>
              <td className={styles["payment-details-label"]}>{payment.serviceFee}</td>
              <td className={styles["payment-details-separator"]}>:</td>
              <td>{payment.serviceFeeAmount} {payment.serviceFeePercentage && `(${payment.serviceFeePercentage})`}</td>
            </tr>
          </tbody>
        </table>

        {/* Discount */}
        <hr className={styles["payment-details-divider"]} />
        <div className={styles["payment-details-section-title"]}>Discount</div>
        <table className={styles["payment-details-table"]}>
          <tbody>
            <tr>
              <td className={styles["payment-details-label"]}>{payment.discount}</td>
              <td className={styles["payment-details-separator"]}>:</td>
              <td>{payment.discountAmount} {payment.discountPercentage && `(${payment.discountPercentage})`}</td>
            </tr>
          </tbody>
        </table>

        {/* Total */}
        <hr className={styles["payment-details-divider"]} />
        <div className={styles["payment-details-total-row"]}>
          <span>Total Estimated Amount</span>
          <span className={styles["payment-details-total"]}>
            {isEditing ? calculateTotalEstimatedAmount() : payment.total}
          </span>
        </div>

        {/* Invoice and Payment Status Section */}
        <hr className={styles["payment-details-divider"]} />
        
        {isEditing ? (
          <div className={styles["invoice-edit-section"]}>
            <div className={styles["payment-details-section-title"]}>Edit Invoice & Payment Information</div>
            
            {/* Invoice Number Input */}
            <div className={styles["form-group"]}>
              <label className={styles["form-label"]}>Invoice Number <span className={styles["required"]}>*</span></label>
              <input
                type="text"
                className={styles["form-input"]}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Enter invoice number"
              />
            </div>

            {/* Invoice Image Upload */}
            <div className={styles["form-group"]}>
              <label className={styles["form-label"]}>Invoice Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                disabled={isExtracting}
              />
              <div 
                className={styles["file-input"]}
                onClick={() => !isExtracting && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                style={{ opacity: isExtracting ? 0.6 : 1, cursor: isExtracting ? 'not-allowed' : 'pointer' }}
              >
                {isExtracting ? 'Extracting invoice number...' : (invoiceFile ? invoiceFile.name : 'Click to upload invoice image')}
              </div>
              
              {extractedInvoiceNumber && (
                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#e8f5e9', borderRadius: '4px', fontSize: '14px' }}>
                  ✓ Found invoice number in image: <strong>{extractedInvoiceNumber}</strong>
                </div>
              )}
              
              {invoicePreview && (
                <div className={styles["image-preview-container"]}>
                  <img 
                    src={invoicePreview} 
                    alt="Invoice preview" 
                    className={styles["invoice-preview"]}
                  />
                  <button
                    type="button"
                    className={styles["remove-image-button"]}
                    onClick={handleRemoveImage}
                    disabled={isExtracting}
                  >
                    Remove Image
                  </button>
                </div>
              )}
            </div>

            {/* Payment Status Dropdown */}
            <div className={styles["form-group"]}>
              <label className={styles["form-label"]}>Payment Status <span className={styles["required"]}>*</span></label>
              <select
                className={styles["form-select"]}
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="Unpaid">Unpaid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Fully Paid">Fully Paid</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className={styles["button-group"]}>
              <button
                className={styles["save-button"]}
                onClick={handleSaveChanges}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                className={styles["cancel-button"]}
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles["payment-details-section-title"]}>Invoice & Payment Information</div>
            <table className={styles["payment-details-table"]}>
              <tbody>
                <tr>
                  <td className={styles["payment-details-label"]}>Invoice Number</td>
                  <td className={styles["payment-details-separator"]}>:</td>
                  <td>
                    {payment.invoiceNumber || (
                      <span className={styles["placeholder-text"]}>Not set</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className={styles["payment-details-label"]}>Invoice Image</td>
                  <td className={styles["payment-details-separator"]}>:</td>
                  <td>
                    {payment.invoiceImageUrl ? (
                      <a 
                        href={payment.invoiceImageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={styles["payment-details-link-highlighted"]}
                      >
                        Click to open
                      </a>
                    ) : (
                      <span className={styles["placeholder-text"]}>Not uploaded</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className={styles["payment-details-label"]}>Payment Status</td>
                  <td className={styles["payment-details-separator"]}>:</td>
                  <td>
                    <span className={`${styles["payment-details-status-value-highlighted"]} ${payment.paymentStatus === "Fully Paid" ? styles["payment-details-status-paid"] : ""}`}>
                      {payment.paymentStatus || "Unpaid"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}