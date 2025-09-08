import { apiGet, apiPost } from './api';

export function getReservationById(id) {
  return apiGet(`/reservation/get-reservation-by-id/${id}`);
}

export function getAllReservationsByStatus(status) {
  return apiGet(`/reservation/get-all-reservations-by-status/${encodeURIComponent(status)}`);
}

export function searchReservations(params = {}) {
  const p = { ...params };
  if (p.search && !p.query) {
    p.query = p.search;
    delete p.search;
  }
  return apiGet('/reservation/search-reservations', p);
}

export function estimateAmount({ facility, adults, children, pwds, serviceType }) {
  return apiGet('/reservation/estimate-amount', { facility, adults, children, pwds, serviceType });
}

export function checkAvailability(params) {
  return apiGet('/reservation/check-availability', params);
}

export function createReservation(payload = {}, letterOfIntentFile) {
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  });
  if (letterOfIntentFile) fd.append('letterOfIntentFile', letterOfIntentFile);
  return apiPost('/reservation/create-reservation', fd);
}

export function updateReservation(id, payload = {}, letterOfIntentFile) {
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  });
  if (letterOfIntentFile) fd.append('letterOfIntentFile', letterOfIntentFile);
  return apiPost(`/reservation/update-reservation/${id}`, fd);
}

export function deleteReservation(id) {
  return apiPost(`/reservation/delete-reservation/${id}`, {});
}

export function cancelReservation(id) {
  return apiPost(`/reservation/cancel-booking/${id}`, {});
}

export function uploadNonavailabilityCertificate(id, file) {
  const fd = new FormData();
  fd.append('nonavailabilityCertFile', file);
  return apiPost(`/reservation/upload-nonavailability-certificate/${id}`, fd);
}

export function decideReservation(id, decisionOrPayload = {}) {
  const body = typeof decisionOrPayload === 'string'
    ? { status: decisionOrPayload }
    : decisionOrPayload;
  return apiPost(`/reservation/accept-or-decline-reservation/${id}`, body);
}

export function checkInOrCheckOutReservation(id, status) {
  return apiPost(`/reservation/checkin-or-checkout-reservation/${id}`, { status });
}
