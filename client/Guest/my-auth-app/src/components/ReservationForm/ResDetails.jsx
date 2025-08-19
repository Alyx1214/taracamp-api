import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './ResDetails.module.css';
import HeaderHome from '../HeaderHome/HeaderHome';
import { buildReservationPayload } from '../Utilities/ReservationMapper';

function ResDetails({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams(); 
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const step1 = location.state?.step1 || {};
  const step2 = location.state?.step2 || {};
  const file = location.state?.file;
  // Example details prop structure (replace with actual props or context as needed)
  // const data = details || {
  //   group: 'Philippine Educators Association',
  //   address: '123 Mabini Street, Quezon City, Philippines',
  //   officeAddress: 'DepEd Regional Office, Manila',
  //   category: 'DepEd',
  //   phone: '0912 345 6789',
  //   officeTel: '(02) 8785 4321',
  //   guests: '100',
  //   emergency: '0918 765 4321',
  //   arrival: 'July 24, 2025',
  //   departure: 'August 5, 2025',
  //   facilityType: 'Conference Hall',
  //   facilityName: 'Quirino Conf Hall',
  //   service: 'Events',
  //   amount: '₱ 12,000.00',
  // };

  const data = useMemo(() => {
    const catKey = Object.entries(step1?.category || {}).find(([, v]) => v)?.[0];
    const guestsTotal =
      (parseInt(step1?.guests?.adult || '0', 10) || 0) +
      (parseInt(step1?.guests?.children || '0', 10) || 0) +
      (parseInt(step1?.guests?.pwds || '0', 10) || 0);

    return {
      group: step1.groupAssociation || '—',
      address: step1.homeAddress || '—',
      officeAddress: step1.officeAddress || '—',
      category: catKey ? catKey.toUpperCase() : '—',
      phone: step1.phoneNo || '—',
      officeTel: step1.officeTelephoneNo || '—',
      guests: String(guestsTotal),
      emergency: step1.emergencyContact || '—',
      arrival: step2.dateArrival || '—',
      departure: step2.dateDeparture || '—',
      facilityType: step2.typeFacilities || '—',
      facilityName: step2.facilityName || '—',
      service: step2.typeService === 'Other' ? (step2.customService || 'Other') : (step2.typeService || '—'),
      amount: '—' // estimated amount is computed server-side; show placeholder
    };
  }, [step1, step2]);

  async function handleSubmit() {
    setErr(null);
    setSubmitting(true);
    try {
      const payload = buildReservationPayload(step1, step2, id, file);

      // quick client-side check to avoid obvious 400s
      const atLeastOneGuest = (payload.numberOfAdults + payload.numberOfChildren + payload.numberOfPwds) > 0;
      if (!atLeastOneGuest) throw new Error('At least one guest is required.');
      if (!payload.dateOfArrival || !payload.dateOfDeparture) throw new Error('Arrival and departure dates are required.');
      if (!payload.timeOfArrival) throw new Error('Time of arrival is required.');
      if (!file) throw new Error('Letter of Intent file is required.');

      const fd = new FormData();
      fd.append('guestName', payload.guestName || '');
      fd.append('homeAddress', payload.homeAddress || '');
      fd.append('officeAddress', payload.officeAddress || '');
      fd.append('category', payload.category || '');
      fd.append('guestType', payload.guestType || '');
      fd.append('telephone', payload.telephone || '');
      fd.append('officeTelephone', payload.officeTelephone || '');
      fd.append('numberOfAdults', String(payload.numberOfAdults || 0));
      fd.append('numberOfChildren', String(payload.numberOfChildren || 0));
      fd.append('numberOfPwds', String(payload.numberOfPwds || 0));
      fd.append('emergencyContact', payload.emergencyContact || '');
      fd.append('dateOfArrival', payload.dateOfArrival);
      fd.append('dateOfDeparture', payload.dateOfDeparture);
      fd.append('facility', payload.facility); // this should be the :id route param
      fd.append('serviceType', payload.serviceType);
      fd.append('timeOfArrival', payload.timeOfArrival);
      fd.append('otherRequests', payload.otherRequests || '');
      fd.append('letterOfIntentFile', file); // field name must match multer.single('letterOfIntentFile')

      const token = localStorage.getItem('accessToken'); // you set this on login
      const res = await fetch(`/api/reservation/create-reservation`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd // never set Content-Type manually for FormData
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Reservation failed');

      // Success: navigate to your history/confirmation
      navigate('/reservations', { replace: true });
    } catch (e) {
      setErr(e.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <HeaderHome />
      <div className={styles.overlay}>
        <div className={styles.detailsCard}>
          <div className={styles.headerBar}>
            <span className={styles.title}>RESERVATION DETAILS</span>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>
          <div className={styles.detailsContent}>
            <table className={styles.detailsTable}>
              <tbody>
                <tr><td>Group/Association</td><td>:</td><td>{data.group}</td></tr>
                <tr><td>Address</td><td>:</td><td>{data.address}</td></tr>
                <tr><td>Office Address</td><td>:</td><td>{data.officeAddress}</td></tr>
                <tr><td>Category</td><td>:</td><td>{data.category}</td></tr>
                <tr><td>Phone No.</td><td>:</td><td>{data.phone}</td></tr>
                <tr><td>Office Telephone No.</td><td>:</td><td>{data.officeTel}</td></tr>
                <tr><td>Number of Guests</td><td>:</td><td>{data.guests}</td></tr>
                <tr><td>Emergency Contact</td><td>:</td><td>{data.emergency}</td></tr>
                <tr><td>Date of Arrival</td><td>:</td><td>{data.arrival}</td></tr>
                <tr><td>Date of Departure</td><td>:</td><td>{data.departure}</td></tr>
                <tr><td>Type of Facility</td><td>:</td><td>{data.facilityType}</td></tr>
                <tr><td>Facility Name</td><td>:</td><td>{data.facilityName}</td></tr>
                <tr><td>Type of Service</td><td>:</td><td>{data.service}</td></tr>
                <tr className={styles.amountRow}>
                  <td colSpan={3}>
                    <div className={styles.amountLine}></div>
                    <div className={styles.amountLabel}>Total Estimated Amount</div>
                    <span className={styles.amountValue}>{data.amount}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className={styles.amountNote}>
              Note that this is just an estimated amount and is subject to change
            </div>
          </div>
        </div>
        <button className={styles.submitBtn} onClick={handleSubmit}>Submit</button>
      </div>
    </>
  );
}

export default ResDetails;
