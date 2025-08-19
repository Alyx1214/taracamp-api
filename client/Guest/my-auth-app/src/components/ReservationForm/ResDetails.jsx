import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './ResDetails.module.css';
import HeaderHome from '../HeaderHome/HeaderHome';
import { buildReservationPayload, mapServiceType } from '../Utilities/ReservationMapper';

function ResDetails({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams(); 
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const [quote, setQuote] = useState(null);

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

  useEffect(() => {
  const a = parseInt(step1?.guests?.adult || 0, 10) || 0;
  const c = parseInt(step1?.guests?.children || 0, 10) || 0;
  const p = parseInt(step1?.guests?.pwds || 0, 10) || 0;
  const fid = step2?.facilityIdFromList || id;
  if (!fid) return;

  const svcEnum = mapServiceType(step2?.typeService);
  
  let abort = false;
  (async () => {
    try {
      const qs = new URLSearchParams({
        facility: fid,
        adults: String(a),
        children: String(c),
        pwds: String(p),
        serviceType: svcEnum || 'MEETING/CONFERENCE'
      });
      const res = await fetch(`/api/reservation/estimate-amount?${qs.toString()}`);
      const json = await res.json();
      if (!abort) setQuote(json?.amount ?? null);
    } catch {
      if (!abort) setQuote(null);
    }
  })();

  return () => { abort = true; };
}, [step1, step2, id]);

const amountText = quote != null ? `₱ ${Math.round(quote).toLocaleString()}` : '—';

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
    };
  }, [step1, step2]);

  async function refreshAccessToken() {
  const rt = localStorage.getItem('refreshToken');
  if (!rt) throw new Error('No refresh token');

  const res = await fetch('/api/user/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.accessToken) {
    throw new Error(data.error || 'Refresh failed');
  }
  localStorage.setItem('accessToken', data.accessToken);
  return data.accessToken;
}

  async function authorizedFetch(url, options) {
    let token = localStorage.getItem('accessToken');
    const headers = new Headers(options?.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      try {
        const newToken = await refreshAccessToken();
        const retryHeaders = new Headers(options?.headers || {});
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
        res = await fetch(url, { ...options, headers: retryHeaders });
      } catch (err) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        throw err;
      }
    }
    return res;
  }

  async function handleSubmit() {
    setErr(null);
    setSubmitting(true);
    try {
      const fid = step2?.facilityIdFromList || id;
      const payload = buildReservationPayload(step1, step2, id, file);

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
      fd.append('letterOfIntentFile', file); 

      const res = await authorizedFetch(`/api/reservation/create-reservation`, {
        method: 'POST',
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Reservation failed');

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
                    <span className={styles.amountValue}>{amountText}</span>
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
