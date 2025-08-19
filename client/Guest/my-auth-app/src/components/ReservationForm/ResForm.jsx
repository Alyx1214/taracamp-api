import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import HeaderHome from '../HeaderHome/HeaderHome'; 
import styles from './ResForm.module.css';
import { ArrowLeft } from 'lucide-react';

function ReservationForm() {
  const navigate = useNavigate();
  const { type, id } = useParams(); 

  if (!type || !id) {
    navigate('/services', { replace: true });
    return null;
  }

  const [formData, setFormData] = useState({
    groupAssociation: '',
    homeAddress: '',
    officeAddress: '',
    category: {
      deped: false,
      government: false,
      pwds: false,
      private: false,
    },
    type: {
      groups: false,
      individual: false,
    },
    phoneNo: '',
    officeTelephoneNo: '',
    guests: {
      adult: '',
      children: '',
      pwds: '',
    },
    emergencyContact: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleCheckboxChange = (group, name) => {
    setFormData((prevData) => ({
      ...prevData,
      [group]: Object.fromEntries(
        Object.keys(prevData[group]).map((key) => [key, key === name])
      ),
    }));
  };

  const handleGuestChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      guests: {
        ...formData.guests,
        [name]: value,
      },
    });
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleNext = () => {
    const step1 = { ...formData };
    navigate(`/reservation-step2/${type}/${id}`, { state: { step1 } });
  };

  const phoneOk = /^(\+63|0)9\d{9}$/.test(formData.phoneNo || '');
  const emerOk  = /^(\+63|0)9\d{9}$/.test(formData.emergencyContact || '');

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
            <form onSubmit={(e) => e.preventDefault()}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Name of Guest/Group/Association</label>
                <input
                  type="text"
                  name="groupAssociation"
                  value={formData.groupAssociation}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Complete Home Address</label>
                <input
                  type="text"
                  name="homeAddress"
                  value={formData.homeAddress}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Office Address</label>
                <input
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
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        name="deped"
                        checked={formData.category.deped}
                        onChange={() => handleCheckboxChange('category', 'deped')}
                        className={styles.checkbox}
                      />
                      DepEd
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        name="government"
                        checked={formData.category.government}
                        onChange={() => handleCheckboxChange('category', 'government')}
                        className={styles.checkbox}
                      />
                      Government
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        name="pwds"
                        checked={formData.category.pwds}
                        onChange={() => handleCheckboxChange('category', 'pwds')}
                        className={styles.checkbox}
                      />
                      PWDs
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        name="private"
                        checked={formData.category.private}
                        onChange={() => handleCheckboxChange('category', 'private')}
                        className={styles.checkbox}
                      />
                      Private
                    </label>
                  </div>
                </div>
                <div className={styles.checkboxGroup}>
                  <label className={styles.label}>Type</label>
                  <div className={styles.checkboxRow}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        name="groups"
                        checked={formData.type.groups}
                        onChange={() => handleCheckboxChange('type', 'groups')}
                        className={styles.checkbox}
                      />
                      Groups
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        name="individual"
                        checked={formData.type.individual}
                        onChange={() => handleCheckboxChange('type', 'individual')}
                        className={styles.checkbox}
                      />
                      Individual
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Telephone No./Phone No.</label>
                  <input
                    type="tel"
                    name="phoneNo"
                    value={formData.phoneNo}
                    onChange={handleInputChange}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Office Telephone No.</label>
                  <input
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
                  <label className={styles.label}>No. of Guest/s</label>
                  <input
                    type="number"
                    name="adult"
                    value={formData.guests.adult}
                    onChange={handleGuestChange}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Adult</label>
                  <input
                    type="number"
                    name="adult"
                    value={formData.guests.adult}
                    onChange={handleGuestChange}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Children</label>
                  <input
                    type="number"
                    name="children"
                    value={formData.guests.children}
                    onChange={handleGuestChange}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>PWDs</label>
                  <input
                    type="number"
                    name="pwds"
                    value={formData.guests.pwds}
                    onChange={handleGuestChange}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Person/s to be notified in case of emergency:</label>
                <input
                  type="tel"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.buttonContainer}>
                <button type="submit" onClick={handleNext} className={styles.nextButton} disabled={!phoneOk || !emerOk}>
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
