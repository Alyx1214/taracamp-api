import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import styles from './ResForm.module.css';
import { ArrowLeft } from 'lucide-react';
import ErrorBanner from '../ErrorBanner/ErrorBanner';
import { getFacilityById } from '../../apis/facilityApi';
import { getUserName } from '../../utils/auth';

function ReservationForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { type, facilityName, id } = useParams();
  const prevStep2Ref = useRef(location.state?.step2 || null);
  const prevFileRef = useRef(location.state?.file || null);

  const [facility, setFacility] = useState(location.state?.facility || null);
  const [loading, setLoading] = useState(!facility);

  useEffect(() => {
    let active = true;
    if (facility) return;           
    setLoading(true);
    getFacilityById(id)
      .then(res => active && setFacility(res.facility))
      .catch(() => active && setFacility(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  const [formData, setFormData] = useState({
    groupAssociation: '',
    homeAddress: '',
    officeAddress: '',
    category: { deped: false, government: false, pwds: false, private: false },
    type: { groups: false, individual: false },
    phoneNo: '',
    officeTelephoneNo: '',
    guests: { adult: '', children: '', pwds: '', senior: '' },
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

  // Populate guest name field from localStorage (stored during login)
  useEffect(() => {
    // Skip if groupAssociation is already set from location.state or user input
    if (location.state?.step1?.groupAssociation || formData.groupAssociation) return;
    
    // Get user name from localStorage (stored during login)
    const userName = getUserName();
    if (userName) {
      setFormData(prev => {
        // Double-check it's still empty before setting
        if (prev.groupAssociation) return prev;
        return {
          ...prev,
          groupAssociation: userName
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]); // Run after location.state is processed

  // Auto-select "Groups" type for Conference facilities
  useEffect(() => {
    const isConference = facility?.facilityType?.toLowerCase().includes('conference') || 
                         type?.toLowerCase() === 'conference';
    
    if (isConference && !formData.type.groups) {
      setFormData(prev => ({
        ...prev,
        type: { groups: true, individual: false }
      }));
      // Clear type error if it exists
      setErrors(prev => ({ ...prev, type: undefined }));
    }
  }, [facility?.facilityType, type, formData.type.groups]);

  const hasCategory = useMemo(() => Object.values(formData.category || {}).some(Boolean), [formData.category]);
  const hasType = useMemo(() => Object.values(formData.type || {}).some(Boolean), [formData.type]);

  const totalGuests = useMemo(() => {
    const a = parseInt(formData.guests.adult || '0', 10);
    const c = parseInt(formData.guests.children || '0', 10);
    const p = parseInt(formData.guests.pwds || '0', 10);
    const s = parseInt(formData.guests.senior || '0', 10);
    return (Number.isFinite(a) ? a : 0) + (Number.isFinite(c) ? c : 0) + (Number.isFinite(p) ? p : 0) + (Number.isFinite(s) ? s : 0);
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
    let clean = value === '' ? '' : clampNonNegativeInt(value);
    
    // If facility has a capacity, prevent total from exceeding it
    if (facility?.capacity && clean !== '') {
      const currentValue = parseInt(clean, 10);
      if (Number.isFinite(currentValue)) {
        // Calculate total of all other guest fields (excluding the one being changed)
        const otherTotals = Object.entries(formData.guests)
          .filter(([key]) => key !== name)
          .reduce((sum, [, val]) => {
            const num = parseInt(val || '0', 10);
            return sum + (Number.isFinite(num) ? num : 0);
          }, 0);
        
        // Calculate maximum allowed value for this field
        const maxAllowed = facility.capacity - otherTotals;
        
        // Clamp the value to not exceed capacity
        if (currentValue > maxAllowed) {
          clean = Math.max(0, maxAllowed);
        }
      }
    }
    
    setFormData(prev => ({ ...prev, guests: { ...prev.guests, [name]: clean } }));
    const guestErrKey = name === 'adult' ? 'guestsAdult' : name === 'children' ? 'guestsChildren' : name === 'pwds' ? 'guestsPwds' : 'guestsSenior';
    // Clear type error when guest count changes since validation depends on both type and guest count
    setErrors(prev => ({ ...prev, [guestErrKey]: undefined, guestsTotal: undefined, type: undefined }));
  };

  const phoneOk = /^(\+63|0)9\d{9}$/.test(formData.phoneNo || '');
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
    if (!phoneNumbersDifferent) e.emergencyContact = 'Emergency contact number must be different from your phone number.';
    if (!hasCategory) e.category = 'Please select a category.';
    if (!hasType) e.type = 'Please select a type.';

    const a = parseInt(formData.guests.adult || '0', 10) || 0;
    const c = parseInt(formData.guests.children || '0', 10) || 0;
    const p = parseInt(formData.guests.pwds || '0', 10) || 0;
    const s = parseInt(formData.guests.senior || '0', 10) || 0;
    const total = a + c + p + s;

    if (a < 0) e.guestsAdult = 'Adult guests cannot be negative.';
    if (c < 0) e.guestsChildren = 'Children cannot be negative.';
    if (p < 0) e.guestsPwds = 'PWD guests cannot be negative.';
    if (s < 0) e.guestsSenior = 'Senior citizen guests cannot be negative.';
    if (total <= 0) e.guestsTotal = 'At least 1 guest is required.';
    if (facility?.capacity && total > facility.capacity) {
      e.guestsTotal = `Total guests (${total}) exceeds facility capacity (${facility.capacity}).`;
    }

    // Require at least 1 PWD guest when PWD category is selected
    if (formData.category?.pwds && p < 1) {
      e.category = 'PWD category requires at least 1 PWD guest.';
    }

    // Validate individual type with more than 50 guests
    if (formData.type?.individual && total > 50) {
      e.type = 'Individual reservations are limited to a maximum of 50 guests. Please select "Group" type for more than 50 guests.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const handleGoBack = () => {
  const fallback = `/user/services/${type}/${facilityName}/${id}`; 
  const to = location.state?.from || fallback;

  navigate(to, {
    replace: true, 
    state: {
      facility: facility || location.state?.facility,
      preselectedDates: location.state?.preselectedDates,
      step1: formData,
      errorsStep1: errors,
      serverError: serverErr,
      step2: prevStep2Ref.current,
      file: prevFileRef.current
    }
  });
};


  const handleNext = () => {
    if (!validateStep1()) return;
    const step1 = { ...formData };
    const navigationState = {
      step1,
      type,
      facilityName,
      facility,
      step2: prevStep2Ref.current,
      file: prevFileRef.current
    };

    // Preserve preselectedDates from ServiceDetail
    if (location.state?.preselectedDates) {
      navigationState.preselectedDates = location.state.preselectedDates;
    }

    navigate(`/reservation-step2/${type}/${facilityName}/${id}`, {
      state: navigationState
    });
  };

  return (
    <>
      <HeaderHome />
      <div className={styles.reservationFormContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.headerSection}>
            <button onClick={handleGoBack} className={styles.backButton} aria-label="Go back">
              <ArrowLeft size={24} />
            </button>
            <h1 className={styles.pageTitle}>
              RESERVATION FORM{facility?.name ? ` / ${facility.name}` : ''}
            </h1>
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
                    {['groups','individual'].map(k => {
                      const isConference = facility?.facilityType?.toLowerCase().includes('conference') || 
                                          type?.toLowerCase() === 'conference';
                      const isDisabled = k === 'individual' && isConference;
                      
                      return (
                        <label className={styles.checkboxLabel} key={k} style={{ opacity: isDisabled ? 0.5 : 1 }}>
                          <input
                            type="checkbox"
                            name={k}
                            checked={formData.type[k]}
                            onChange={() => handleCheckboxChange('type', k)}
                            className={styles.checkbox}
                            disabled={isDisabled}
                          />
                          {k.charAt(0).toUpperCase() + k.slice(1)}
                        </label>
                      );
                    })}
                  </div>
                  {(() => {
                    const isConference = facility?.facilityType?.toLowerCase().includes('conference') || 
                                        type?.toLowerCase() === 'conference';
                    if (isConference) {
                      return <p className={styles.noteText} style={{ color: '#0066cc' }}>Note: Conference facilities are only available for group bookings. "Groups" type has been automatically selected.</p>;
                    }
                    return <p className={styles.noteText}>Note: Individuals may reserve dorms, guest houses, and cottages only. Halls are for group bookings.</p>;
                  })()}
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
              <div className={styles.guestRow}>
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
                  <label className={styles.label} htmlFor="children">Children (6 below)</label>
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
              </div>

              <div className={styles.guestRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="senior">Senior Citizen</label>
                  <input
                    id="senior"
                    type="number"
                    name="senior"
                    {...numberGuardProps}
                    value={formData.guests.senior}
                    onChange={handleGuestChange}
                    className={`${styles.input} ${errors.guestsSenior ? styles.inputError : ''}`}
                    inputMode="numeric"
                  />
                  {errors.guestsSenior && <div className={styles.fieldError}>{errors.guestsSenior}</div>}
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