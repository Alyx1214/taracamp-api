import { apiGet, apiPost } from './api';

export function getReservationById(id) {
  return apiGet(`/api/reservation/get-reservation-by-id/${id}`);
}

export function getAllReservationsByStatus(status) {
  return apiGet(`/api/reservation/get-all-reservations-by-status/${encodeURIComponent(status)}`);
}

export function searchReservations(params = {}) {
  return apiGet('/api/reservation/search-reservations', params);
}

export function estimateAmount({ facility, adults, children, pwds, serviceType }) {
  return apiGet('/api/reservation/estimate-amount', { facility, adults, children, pwds, serviceType });
}

export function checkAvailability(params) {
  return apiGet('/api/reservation/check-availability', params);
}

export function createReservation(payload = {}, letterOfIntentFile) {
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  });
  if (letterOfIntentFile) fd.append('letterOfIntentFile', letterOfIntentFile);
  return apiPost('/api/reservation/create-reservation', fd);
}

export function updateReservation(id, payload = {}, letterOfIntentFile) {
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  });
  if (letterOfIntentFile) fd.append('letterOfIntentFile', letterOfIntentFile);
  return apiPost(`/api/reservation/update-reservation/${id}`, fd);
}

export function deleteReservation(id) {
  return apiPost(`/api/reservation/delete-reservation/${id}`, {});
}

export function cancelReservation(id) {
  return apiPost(`/api/reservation/cancel-booking/${id}`, {});
}

export function uploadNonavailabilityCertificate(id, file) {
  const fd = new FormData();
  fd.append('nonavailabilityCertFile', file);
  return apiPost(`/api/reservation/upload-nonavailability-certificate/${id}`, fd);
}

export function decideReservation(id, decisionOrPayload = {}) {
  const body = typeof decisionOrPayload === 'string'
    ? { status: decisionOrPayload }
    : decisionOrPayload;
  return apiPost(`/api/reservation/accept-or-decline-reservation/${id}`, body);
}
