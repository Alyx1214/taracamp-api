import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome';
import styles from './ResForm.module.css';
import { ArrowLeft } from 'lucide-react';
import ErrorBanner from '../ErrorBanner/ErrorBanner';

function ReservationForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { type, id } = useParams();

  if (!type || !id) {
    navigate('/services', { replace: true });
    return null;
  }

  const [formData, setFormData] = useState({
    groupAssociation: '',
    homeAddress: '',
    officeAddress: '',
    category: { deped: false, government: false, pwds: false, private: false },
    type: { groups: false, individual: false },
    phoneNo: '',
    officeTelephoneNo: '',
    guests: { adult: '', children: '', pwds: '' },
    emergencyContact: '',
  });

  const [errors, setErrors] = useState({});
  const [serverErr, setServerErr] = useState(null);

  // Restore values + errors + optional banner from backend
  useEffect(() => {
    if (location.state?.step1) setFormData(location.state.step1);
    if (location.state?.errorsStep1) setErrors(location.state.errorsStep1);
    if (location.state?.serverError) setServerErr(location.state.serverError);
  }, [location.state]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined })); // clear that field's error
  };

  const handleCheckboxChange = (group, name) => {
    setFormData(prevData => ({
      ...prevData,
      [group]: Object.fromEntries(Object.keys(prevData[group]).map(k => [k, k === name])),
    }));
  };

  const handleGuestChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, guests: { ...prev.guests, [name]: value } }));
    const guestErrKey = name === 'adult' ? 'guestsAdult' : name === 'children' ? 'guestsChildren' : 'guestsPwds';
    setErrors(prev => ({ ...prev, [guestErrKey]: undefined }));
  };

  const phoneOk = /^(\+63|0)9\d{9}$/.test(formData.phoneNo || '');
  const emerOk  = /^(\+63|0)9\d{9}$/.test(formData.emergencyContact || '');

  function validateStep1() {
    const e = {};
    if (!formData.groupAssociation?.trim()) e.groupAssociation = 'Required';
    if (!formData.homeAddress?.trim()) e.homeAddress = 'Required';
    if (!phoneOk) e.phoneNo = 'Enter a valid PH mobile (e.g., 09XXXXXXXXX or +639XXXXXXXXX).';
    if (!emerOk) e.emergencyContact = 'Enter a valid PH mobile for emergency contact.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const handleGoBack = () => navigate(-1);

  const handleNext = () => {
    if (!validateStep1()) {
      setServerErr({ message: 'Please fix the errors highlighted below before continuing.' });
      return;
    }
    setServerErr(null);
    const step1 = { ...formData };
    navigate(`/reservation-step2/${type}/${id}`, { state: { step1 } });
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
            <h1 className={styles.pageTitle}>RESERVATION FORM</h1>
          </div>

          <div className={styles.formCard}>
            <ErrorBanner err={serverErr} onClose={() => setServerErr(null)} />

            <form onSubmit={(e) => e.preventDefault()}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="groupAssociation">Name of Guest/Group/Association</label>
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
                <label className={styles.label} htmlFor="homeAddress">Complete Home Address</label>
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

              <div className={styles.checkboxGroupContainer}>
                <div className={styles.checkboxGroup}>
                  <label className={styles.label}>Select Category</label>
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
                </div>

                <div className={styles.checkboxGroup}>
                  <label className={styles.label}>Type</label>
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
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="phoneNo">Telephone No./Phone No.</label>
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
                  <label className={styles.label} htmlFor="officeTelephoneNo">Office Telephone No.</label>
                  <input
                    id="officeTelephoneNo"
                    type="tel"
                    name="officeTelephoneNo"
                    value={formData.officeTelephoneNo}
                    onChange={handleInputChange}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="guestsTotal">No. of Guest/s</label>
                  <input
                    id="guestsTotal"
                    type="number"
                    name="adult"
                    value={formData.guests.adult}
                    onChange={handleGuestChange}
                    className={`${styles.input} ${errors.guestsAdult ? styles.inputError : ''}`}
                    inputMode="numeric"
                  />
                  {errors.guestsAdult && <div className={styles.fieldError}>{errors.guestsAdult}</div>}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="adult">Adult</label>
                  <input
                    id="adult"
                    type="number"
                    name="adult"
                    value={formData.guests.adult}
                    onChange={handleGuestChange}
                    className={`${styles.input} ${errors.guestsAdult ? styles.inputError : ''}`}
                    inputMode="numeric"
                  />
                  {errors.guestsAdult && <div className={styles.fieldError}>{errors.guestsAdult}</div>}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="children">Children</label>
                  <input
                    id="children"
                    type="number"
                    name="children"
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
                    value={formData.guests.pwds}
                    onChange={handleGuestChange}
                    className={`${styles.input} ${errors.guestsPwds ? styles.inputError : ''}`}
                    inputMode="numeric"
                  />
                  {errors.guestsPwds && <div className={styles.fieldError}>{errors.guestsPwds}</div>}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="emergencyContact">Person/s to be notified in case of emergency:</label>
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
                <button type="submit" onClick={handleNext} className={styles.nextButton}>
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
