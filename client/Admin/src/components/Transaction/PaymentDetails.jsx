import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./PaymentDetails.module.css";
import { getPaymentDetails, updatePaymentStatus, uploadInvoice } from "../../apis/paymentApi"; 

export default function PaymentDetails() {
  const { id: reservationId } = useParams();
  const navigate = useNavigate();

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

  const fileInputRef = React.useRef(null);

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

  const handleFileChange = (e) => {
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
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoicePreview(reader.result);
      };
      reader.readAsDataURL(file);
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

    setSaving(true);
    
    try {
      // Upload invoice image if changed
      let invoiceImageUrl = payment?.invoiceImageUrl;
      if (invoiceFile) {
        const uploadRes = await uploadInvoice(reservationId, invoiceFile);
        if (uploadRes?.data?.invoiceImageUrl) {
          invoiceImageUrl = uploadRes.data.invoiceImageUrl;
        }
      }

      // Update payment details
      const updateRes = await updatePaymentStatus(reservationId, {
        invoiceNumber: invoiceNumber.trim(),
        paymentStatus,
        invoiceImageUrl
      });

      if (updateRes?.status === 200 || updateRes?.success) {
        setUpdateSuccess("Payment details updated successfully");
        
        // Update local state with new payment info
        setPayment(prev => ({
          ...prev,
          invoiceNumber: invoiceNumber.trim(),
          paymentStatus,
          invoiceImageUrl
        }));
        
        setIsEditing(false);
        
        // Clear success message after 3 seconds
        setTimeout(() => setUpdateSuccess(""), 3000);
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
    setUpdateError("");
    setUpdateSuccess("");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
        {/* Edit Button - Positioned in upper right corner */}
        {!isEditing && (
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
                    className={styles["payment-details-link"]}
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
          <span className={styles["payment-details-total"]}>{payment.total}</span>
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
              />
              <div 
                className={styles["file-input"]}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                {invoiceFile ? invoiceFile.name : 'Click to upload invoice image'}
              </div>
              
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
            
            {/* Invoice Information Card */}
            <div className={styles["invoice-info-card"]}>
              <div className={styles["invoice-info-item"]}>
                <div className={styles["invoice-info-label"]}>
                  <span className={styles["invoice-icon"]}>📄</span>
                  Invoice Number
                </div>
                <div className={styles["invoice-info-value"]}>
                  {payment.invoiceNumber || "Not set"}
                </div>
              </div>

              {payment.invoiceImageUrl && (
                <div className={styles["invoice-info-item"]}>
                  <div className={styles["invoice-info-label"]}>
                    <span className={styles["invoice-icon"]}>🖼️</span>
                    Invoice Image
                  </div>
                  <div className={styles["invoice-info-value"]}>
                    <a 
                      href={payment.invoiceImageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={styles["invoice-link"]}
                    >
                      View Invoice Image
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Status Card */}
            <div className={styles["payment-status-card"]}>
              <div className={styles["payment-status-label"]}>
                Payment Status
              </div>
              <div className={styles["payment-status-value"]}>
                <span className={`${styles["status-badge"]} ${styles[`status-${payment.paymentStatus?.toLowerCase().replace(' ', '-')}`]}`}>
                  {payment.paymentStatus || "Unpaid"}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}