import { apiGet, apiPost } from './api';

export function getMyReservations() {
  return apiGet('/reservation/get-reservation-by-user-id');
}

export function getReservationById(id) {
  return apiGet(`/reservation/get-reservation-by-id/${encodeURIComponent(id)}`);
}

export function getAllReservationsByStatus(status) {
  return apiGet(`/reservation/get-all-reservations-by-status/${encodeURIComponent(status)}`);
}

export function estimateAmount({ facility, adults, children, pwds, seniorCitizens, serviceType, category, addOns }) {
  return apiGet('/reservation/estimate-amount', { facility, adults, children, pwds, seniorCitizens, serviceType, category, addOns });
}

export function checkAvailability(params) {
  return apiGet('/reservation/check-availability', params);
}

export function createReservation(payload = {}, letterOfIntentFile, seniorCitizenIdFile) {
  const fd = new FormData();

  // Avoid leaking internal IDs and force primitives to strings
  const { letterOfIntentFileId, seniorCitizenIdFileId, ...safe } = payload || {};

  Object.entries(safe).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    // Explicitly ensure facility is a plain string
    if (key === 'facility') {
      fd.append('facility', String(value));
      return;
    }

    // Append arrays as repeated fields (server accepts arrays)
    if (Array.isArray(value)) {
      value.forEach((item) => {
        fd.append(key, String(item));
      });
      return;
    }

    // Files are handled separately; skip here
    if (typeof File !== 'undefined' && value instanceof File) return;
    if (typeof Blob !== 'undefined' && value instanceof Blob) return;

    // Primitives -> strings; objects -> JSON string
    if (typeof value === 'object') {
      fd.append(key, JSON.stringify(value));
    } else {
      fd.append(key, String(value));
    }
  });

  if (letterOfIntentFile) fd.append('letterOfIntentFile', letterOfIntentFile);
  if (seniorCitizenIdFile) fd.append('seniorCitizenIdFile', seniorCitizenIdFile);
  return apiPost('/reservation/create-reservation', fd);
}

export function updateReservation(id, payload = {}, letterOfIntentFile) {
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  });
  if (letterOfIntentFile) fd.append('letterOfIntentFile', letterOfIntentFile);
  return apiPost(`/reservation/update-reservation/${encodeURIComponent(id)}`, fd);
}

export function cancelReservation(id) {
  return apiPost(`/reservation/cancel-booking/${encodeURIComponent(id)}`, {});
}

export function decideReservation(id, { decision, reason } = {}) {
  return apiPost(`/reservation/accept-or-decline-reservation/${encodeURIComponent(id)}`, { decision, reason });
}

