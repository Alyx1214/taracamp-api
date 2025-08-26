import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './ResDetails.module.css';
import HeaderHome from '../HeaderHome/HeaderHome';
import { buildReservationPayload, mapServiceType } from '../Utilities/ReservationMapper';
import ErrorBanner from '../ErrorBanner/ErrorBanner';

function ResDetails({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const [quote, setQuote] = useState(null);
  const API = import.meta.env.VITE_API_URL;

  const {
    id: stateId,
    facility,
    type,
    step1 = {},
    step2 = {},
    file,
  } = location.state || {};

  const id =
    typeof stateId === 'string'
      ? stateId
      : (stateId && (stateId._id || stateId.id)) ||
        (typeof facility === 'string'
          ? facility
          : (facility && (facility._id || facility.id)) || '');

  useEffect(() => {
      if (!id) navigate('/services', { replace: true });
    }, [id, navigate]);

  useEffect(() => {
    if (!id) return;

    const a = parseInt(step1?.guests?.adult || 0, 10) || 0;
    const c = parseInt(step1?.guests?.children || 0, 10) || 0;
    const p = parseInt(step1?.guests?.pwds || 0, 10) || 0;

    const fid =
      typeof step2?.facilityIdFromList === 'string'
        ? step2.facilityIdFromList
        : (step2?.facilityIdFromList && (step2.facilityIdFromList._id || step2.facilityIdFromList.id)) || id;
    if (!fid) return;

    let abort = false;
    (async () => {
      try {
        const qs = new URLSearchParams({
          facility: fid,
          adults: String(a),
          children: String(c),
          pwds: String(p),
          serviceType: (mapServiceType(step2?.typeService) || 'MEETING/CONFERENCE'),
        });
        const res = await fetch(`${API}/reservation/estimate-amount?${qs.toString()}`);
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
      group: step1.groupAssociation || 'N/A',
      address: step1.homeAddress || 'N/A',
      officeAddress: step1.officeAddress || 'N/A',
      category: catKey ? catKey.toUpperCase() : 'N/A',
      phone: step1.phoneNo || 'N/A',
      officeTel: step1.officeTelephoneNo || 'N/A',
      guests: String(guestsTotal),
      emergency: step1.emergencyContact || 'N/A',
      arrival: step2.dateArrival || 'N/A',
      departure: step2.dateDeparture || 'N/A',
      facilityType: step2.typeFacilities || 'N/A',
      facilityName: step2.facilityLabelFromList || step2.facilityName || 'N/A',
      service: step2.typeService === 'Other' ? (step2.customService || 'Other') : (step2.typeService || '—'),
    };
  }, [step1, step2]);

  async function refreshAccessToken() {
    const rt = localStorage.getItem('refreshToken');
    if (!rt) throw new Error('No refresh token');
    const res = await fetch(`${API}/user/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.accessToken) throw new Error(data.error || 'Refresh failed');
    localStorage.setItem('accessToken', data.accessToken);
    return data.accessToken;
  }

  async function authorizedFetch(url, options) {
    const tryOnce = async (tokenOverride) => {
      const headers = new Headers(options?.headers || {});
      const token = tokenOverride || localStorage.getItem('accessToken');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(url, { ...options, headers });
    };

    let res = await tryOnce();
    if (res.status === 401 || res.status === 403) {
      try {
        const newToken = await refreshAccessToken();
        res = await tryOnce(newToken);
      } catch (err) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        navigate('/auth/login', { replace: true });
        throw err;
      }
    }
    return res;
  }

  async function handleSubmit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setErr(null);
    setSubmitting(true);

    try {
      const payload = buildReservationPayload(step1, step2, id, file);

      const atLeastOneGuest =
        payload.numberOfAdults + payload.numberOfChildren + payload.numberOfPwds > 0;
      if (!atLeastOneGuest) throw new Error('At least one guest is required.');
      if (!payload.dateOfArrival || !payload.dateOfDeparture)
        throw new Error('Arrival and departure dates are required.');
      if (!payload.timeOfArrival) throw new Error('Time of arrival is required.');
      if (!file) throw new Error('Letter of Intent file is required.');

      const facilityForPost =
        typeof step2?.facilityIdFromList === 'string'
          ? step2.facilityIdFromList
          : (step2?.facilityIdFromList && (step2.facilityIdFromList._id || step2.facilityIdFromList.id)) || id;

      const fd = new FormData();
      Object.entries({
        guestName: payload.guestName || '',
        homeAddress: payload.homeAddress || '',
        officeAddress: payload.officeAddress || '',
        category: payload.category || '',
        guestType: payload.guestType || '',
        telephone: payload.telephone || '',
        officeTelephone: payload.officeTelephone || '',
        numberOfAdults: String(payload.numberOfAdults || 0),
        numberOfChildren: String(payload.numberOfChildren || 0),
        numberOfPwds: String(payload.numberOfPwds || 0),
        emergencyContact: payload.emergencyContact || '',
        dateOfArrival: payload.dateOfArrival,
        dateOfDeparture: payload.dateOfDeparture,
        facility: facilityForPost, 
        serviceType: payload.serviceType,
        timeOfArrival: payload.timeOfArrival,
        otherRequests: payload.otherRequests || '',
      }).forEach(([k, v]) => fd.append(k, v));
      fd.append('letterOfIntentFile', file);

      const res = await authorizedFetch(`${API}/reservation/create-reservation`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const server = {
          message: data.error || data.message || 'Reservation failed',
          details: Array.isArray(data.details) ? data.details : null,
          status: data.status || res.status,
        };
        setErr(server);

        let mapped = { errorsStep1: {}, errorsStep2: {} };
        if (server.details?.length) {
          const step1Map = {
            guestName: 'groupAssociation', homeAddress: 'homeAddress', officeAddress: 'officeAddress',
            category: 'category', guestType: 'type', telephone: 'phoneNo', officeTelephone: 'officeTelephoneNo',
            emergencyContact: 'emergencyContact', numberOfAdults: 'guestsAdult', numberOfChildren: 'guestsChildren', numberOfPwds: 'guestsPwds',
          };
          const step2Map = {
            dateOfArrival: 'dateArrival', dateOfDeparture: 'dateDeparture', facility: 'facilityName',
            serviceType: 'typeService', timeOfArrival: 'timeArrivalHour', otherRequests: 'specialRequests',
          };
          const e1 = {}, e2 = {};
          for (const d of server.details) {
            const ui1 = step1Map[d.field]; const ui2 = step2Map[d.field];
            const msg = d.message || d.code || 'Invalid';
            if (ui1) e1[ui1] = msg;
            if (ui2) e2[ui2] = msg;
          }
          mapped = { errorsStep1: e1, errorsStep2: e2 };
        } else {
          const m = (server.message || '').toLowerCase();
          const e1 = {}, e2 = {};
          if (m.includes('invalid phone')) e1.phoneNo = 'Enter a valid PH mobile number.';
          if (m.includes('emergency')) e1.emergencyContact = 'Enter a valid PH mobile number.';
          if (m.includes('at least one guest')) e1.guestsAdult = 'Enter at least one guest.';
          if (m.includes('invalid date range')) {
            e2.dateArrival = 'Arrival must be tomorrow or later.';
            e2.dateDeparture = 'Departure must be after arrival.';
          }
          if (m.includes('facility is not available')) {
            e2.dateArrival = 'Facility is not available for the selected dates.';
            e2.dateDeparture = 'Choose different dates.';
            e2.facilityName = 'Select another facility or change the date range.';
          }
          mapped = { errorsStep1: e1, errorsStep2: e2 };
        }

        if (Object.keys(mapped.errorsStep1).length) {
          navigate('/reservation-form', {
            state: { step1, errorsStep1: mapped.errorsStep1, serverError: server, type, facility: id, file },
          });
          return;
        }
        if (Object.keys(mapped.errorsStep2).length) {
          navigate('/reservation-step2', {
            state: { step1, step2, errorsStep2: mapped.errorsStep2, serverError: server, type, facility: id, file },
          });
          return;
        }
        return;
      }

      navigate('/reservations', { replace: true });
    } catch (e) {
      setErr({ message: e.message || 'Submission failed.' });
    } finally {
      setSubmitting(false);
      inFlight.current = false;
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
            <ErrorBanner err={err} onClose={() => setErr(null)} />

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

        <button type="button" className={styles.submitBtn} onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </>
  );
}

export default ResDetails;
