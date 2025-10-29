import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './ResForm.module.css';
import { ArrowLeft } from 'lucide-react';
import ErrorBanner from '../ErrorBanner/ErrorBanner';

function ReservationForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const prevStep2Ref = useRef(location.state?.step2 || null);
  const prevFileRef = useRef(location.state?.file || null);

  const [formData, setFormData] = useState({
    groupAssociation: '',
    homeAddress: '',
    officeAddress: '',
    category: { deped: false, government: false, pwds: false, private: false },
    type: { groups: false, individual: false },
    phoneNo: '',
    guestEmail: '',
    officeTelephoneNo: '',
    guests: { adult: '', children: '', pwds: '' }, 
    emergencyContactPerson: '',
    emergencyContact: '',
  });

  const [errors, setErrors] = useState({});
  const [serverErr, setServerErr] = useState(null);
  const numberGuardProps = {
  onWheel: e => e.currentTarget.blur(),
  onKeyDown: e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
  }
};

  useEffect(() => {
    if (location.state?.step1) setFormData(location.state.step1);
    if (location.state?.errorsStep1) setErrors(location.state.errorsStep1);
    if (location.state?.serverError) setServerErr(location.state.serverError);
  }, [location.state]);

  const hasCategory = useMemo(() => Object.values(formData.category || {}).some(Boolean), [formData.category]);
  const hasType = useMemo(() => Object.values(formData.type || {}).some(Boolean), [formData.type]);

  const totalGuests = useMemo(() => {
    const a = parseInt(formData.guests.adult || '0', 10);
    const c = parseInt(formData.guests.children || '0', 10);
    const p = parseInt(formData.guests.pwds || '0', 10);
    return (Number.isFinite(a) ? a : 0) + (Number.isFinite(c) ? c : 0) + (Number.isFinite(p) ? p : 0);
  }, [formData.guests]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleCheckboxChange = (group, name) => {
    setFormData(prevData => ({
      ...prevData,
      [group]: Object.fromEntries(Object.keys(prevData[group]).map(k => [k, k === name])),
    }));
    setErrors(prev => ({ ...prev, [group]: undefined }));
  };

  const clampNonNegativeInt = (raw) => {
    if (raw === '' || raw === null || raw === undefined) return '';
    const n = parseInt(String(raw).replace(/[^\d-]/g, ''), 10);
    if (!Number.isFinite(n)) return '';
    return Math.max(0, n);
  };

  const handleGuestChange = (e) => {
    const { name, value } = e.target;
    const clean = value === '' ? '' : clampNonNegativeInt(value);
    setFormData(prev => ({ ...prev, guests: { ...prev.guests, [name]: clean } }));
    const guestErrKey = name === 'adult' ? 'guestsAdult' : name === 'children' ? 'guestsChildren' : 'guestsPwds';
    setErrors(prev => ({ ...prev, [guestErrKey]: undefined, guestsTotal: undefined }));
  };

  const phoneOk = /^(\+63|0)9\d{9}$/.test(formData.phoneNo || '');
  const emailOk = !formData.guestEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guestEmail);
  const emerOk  = /^(\+63|0)9\d{9}$/.test(formData.emergencyContact || '');
  
  const normalizePhone = (phone) => {
    if (!phone) return '';
    return phone.replace(/^\+63/, '').replace(/^0/, '');
  };
  
  const phoneNumbersDifferent = !formData.phoneNo || !formData.emergencyContact || 
    normalizePhone(formData.phoneNo) !== normalizePhone(formData.emergencyContact);

  function validateStep1() {
    const e = {};
    if (!formData.groupAssociation?.trim()) e.groupAssociation = 'Required';
    if (!formData.homeAddress?.trim()) e.homeAddress = 'Required';
    if (!phoneOk) e.phoneNo = 'Enter a valid PH mobile (e.g., 09XXXXXXXXX or +639XXXXXXXXX).';
    if (!formData.emergencyContactPerson?.trim()) e.emergencyContactPerson = 'Required';
    if (!emerOk) e.emergencyContact = 'Enter a valid PH mobile for emergency contact.';
    if (!phoneNumbersDifferent) e.emergencyContact = 'Emergency contact number must be different from the phone number.';
    if (!emailOk) e.guestEmail = 'Enter a valid email address.';
    if (!hasCategory) e.category = 'Please select a category.';
    if (!hasType) e.type = 'Please select a type.';

    const a = parseInt(formData.guests.adult || '0', 10) || 0;
    const c = parseInt(formData.guests.children || '0', 10) || 0;
    const p = parseInt(formData.guests.pwds || '0', 10) || 0;

    if (a < 0) e.guestsAdult = 'Adult guests cannot be negative.';
    if (c < 0) e.guestsChildren = 'Children cannot be negative.';
    if (p < 0) e.guestsPwds = 'PWD guests cannot be negative.';
    if (a + c + p <= 0) e.guestsTotal = 'At least 1 guest is required.';

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const handleGoBack = () => navigate(-1);

  const handleNext = () => {
    if (!validateStep1()) return;
    const step1 = { ...formData };
    navigate(`/reservation-step2`, {
      state: { step1, step2: prevStep2Ref.current, file: prevFileRef.current }
    });
  };

  return (
    <>
      <div className={styles.reservationFormContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.headerSection}>
            <button onClick={handleGoBack} className={styles.backButton} aria-label="Go back">
              <ArrowLeft size={24} />
            </button>
            <h1 className={styles.pageTitle}>RESERVATION FORM</h1>
          </div>

          <div className={styles.formCard}>
            <ErrorBanner err={serverErr} onClose={() => setServerErr(null)} />

            <form onSubmit={(e) => e.preventDefault()}>
              <div className={styles.checkboxGroupContainer}>
                <div className={styles.checkboxGroup}>
                  <label className={styles.label}>Select Category<span className={styles.requiredAsterisk}>*</span></label>
                  <div className={styles.checkboxRow}>
                    {['deped','government','pwds','private'].map(k => (
                      <label className={styles.checkboxLabel} key={k}>
                        <input
                          type="checkbox"
                          name={k}
                          checked={formData.category[k]}
                          onChange={() => handleCheckboxChange('category', k)}
                          className={styles.checkbox}
                        />
                        {k === 'deped' ? 'DepEd' : k.charAt(0).toUpperCase() + k.slice(1)}
                      </label>
                    ))}
                  </div>
                  <p className={styles.noteText}>Note: A 20% discount applies only to DepEd, government employees, senior citizens and PWDs.</p>
                  {errors.category && <div id="category-error" className={styles.fieldError} role="alert">{errors.category}</div>}
                </div>

                <div className={styles.checkboxGroup}>
                  <label className={styles.label}>Type<span className={styles.requiredAsterisk}>*</span></label>
                  <div className={styles.checkboxRow}>
                    {['groups','individual'].map(k => (
                      <label className={styles.checkboxLabel} key={k}>
                        <input
                          type="checkbox"
                          name={k}
                          checked={formData.type[k]}
                          onChange={() => handleCheckboxChange('type', k)}
                          className={styles.checkbox}
                        />
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </label>
                    ))}
                  </div>
                  <p className={styles.noteText}>Note: Individuals may reserve dorms, guest houses, and cottages only. Halls are for group bookings.</p>
                  {errors.type && <div id="type-error" className={styles.fieldError} role="alert">{errors.type}</div>}
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="groupAssociation">Name of Guest/Group/Association<span className={styles.requiredAsterisk}>*</span></label>
                <input
                  id="groupAssociation"
                  type="text"
                  name="groupAssociation"
                  value={formData.groupAssociation}
                  onChange={handleInputChange}
                  className={`${styles.input} ${errors.groupAssociation ? styles.inputError : ''}`}
                  aria-invalid={!!errors.groupAssociation}
                />
                {errors.groupAssociation && <div className={styles.fieldError}>{errors.groupAssociation}</div>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="homeAddress">Complete Home Address<span className={styles.requiredAsterisk}>*</span></label>
                <input
                  id="homeAddress"
                  type="text"
                  name="homeAddress"
                  value={formData.homeAddress}
                  onChange={handleInputChange}
                  className={`${styles.input} ${errors.homeAddress ? styles.inputError : ''}`}
                  aria-invalid={!!errors.homeAddress}
                />
                {errors.homeAddress && <div className={styles.fieldError}>{errors.homeAddress}</div>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="officeAddress">Office Address</label>
                <input
                  id="officeAddress"
                  type="text"
                  name="officeAddress"
                  value={formData.officeAddress}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="phoneNo">Phone No.<span className={styles.requiredAsterisk}>*</span></label>
                <input
                  id="phoneNo"
                  type="tel"
                  name="phoneNo"
                  value={formData.phoneNo}
                  onChange={handleInputChange}
                  className={`${styles.input} ${errors.phoneNo ? styles.inputError : ''}`}
                  aria-invalid={!!errors.phoneNo}
                />
                {errors.phoneNo && <div className={styles.fieldError}>{errors.phoneNo}</div>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="guestEmail">Guest Email</label>
                <input
                  id="guestEmail"
                  type="email"
                  name="guestEmail"
                  value={formData.guestEmail}
                  onChange={handleInputChange}
                  className={`${styles.input} ${errors.guestEmail ? styles.inputError : ''}`}
                  aria-invalid={!!errors.guestEmail}
                />
                {errors.guestEmail && <div className={styles.fieldError}>{errors.guestEmail}</div>}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="officeTelephoneNo">
                  Office Telephone No.
                </label>
                <input
                  id="officeTelephoneNo"
                  type="tel"
                  name="officeTelephoneNo"
                  value={formData.officeTelephoneNo}
                  onChange={handleInputChange}
                  className={`${styles.input} ${errors.officeTelephoneNo ? styles.inputError : ''}`}
                  aria-invalid={!!errors.officeTelephoneNo}
                />
                {errors.officeTelephoneNo && (
                  <div className={styles.fieldError}>{errors.officeTelephoneNo}</div>
                )}
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="adult">Adult</label>
                  <input
                    id="adult"
                    type="number"
                    name="adult"
                    {...numberGuardProps}
                    value={formData.guests.adult}
                    onChange={handleGuestChange}
                    className={`${styles.input} ${errors.guestsAdult ? styles.inputError : ''}`}
                    inputMode="numeric"
                  />
                  {errors.guestsAdult && <div className={styles.fieldError}>{errors.guestsAdult}</div>}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="children">Children (6yrs old below)</label>
                  <input
                    id="children"
                    type="number"
                    name="children"
                    {...numberGuardProps}
                    value={formData.guests.children}
                    onChange={handleGuestChange}
                    className={`${styles.input} ${errors.guestsChildren ? styles.inputError : ''}`}
                    inputMode="numeric"
                  />
                  {errors.guestsChildren && <div className={styles.fieldError}>{errors.guestsChildren}</div>}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="pwds">PWDs</label>
                  <input
                    id="pwds"
                    type="number"
                    name="pwds"
                    {...numberGuardProps}
                    value={formData.guests.pwds}
                    onChange={handleGuestChange}
                    className={`${styles.input} ${errors.guestsPwds ? styles.inputError : ''}`}
                    inputMode="numeric"
                  />
                  {errors.guestsPwds && <div className={styles.fieldError}>{errors.guestsPwds}</div>}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="guestsTotal">Total Guests<span className={styles.requiredAsterisk}>*</span></label>
                <input
                  id="guestsTotal"
                  type="number"
                  value={totalGuests}
                  readOnly
                  className={styles.input}
                />
                {errors.guestsTotal && <div className={styles.fieldError}>{errors.guestsTotal}</div>}
              </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="emergencyContactPerson">Person/s to be notified in case of emergency<span className={styles.requiredAsterisk}>*</span></label>
                <input
                  id="emergencyContactPerson"
                  type="tel"
                  name="emergencyContactPerson"
                  value={formData.emergencyContactPerson}
                  onChange={handleInputChange}
                  className={`${styles.input} ${errors.emergencyContactPerson ? styles.inputError : ''}`}
                  aria-invalid={!!errors.emergencyContactPerson}
                />
                {errors.emergencyContactPerson && <div className={styles.fieldError}>{errors.emergencyContactPerson}</div>}
              </div>  
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="emergencyContact">Emergency contact number<span className={styles.requiredAsterisk}>*</span></label>
                <input
                  id="emergencyContact"
                  type="tel"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleInputChange}
                  className={`${styles.input} ${errors.emergencyContact ? styles.inputError : ''}`}
                  aria-invalid={!!errors.emergencyContact}
                />
                {errors.emergencyContact && <div className={styles.fieldError}>{errors.emergencyContact}</div>}
              </div>

              <div className={styles.buttonContainer}>
                <button
                  type="submit"
                  onClick={handleNext}
                  className={styles.nextButton}
                >
                  Next
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </>
  );
}

export default ReservationForm;
