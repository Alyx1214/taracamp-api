import { apiGet, apiPost } from './api';

export function getMyReservations() {
  return apiGet('/api/reservation/get-reservation-by-user-id');
}
export function getReservationById(id) {
  return apiGet(`/api/reservation/get-reservation-by-id/${id}`);
}
export function getAllReservationsByStatus(status) {
  return apiGet(`/api/reservation/get-all-reservations-by-status/${encodeURIComponent(status)}`);
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
export function cancelReservation(id) {
  return apiPost(`/api/reservation/cancel-booking/${id}`, {});
}
export function decideReservation(id, { decision, reason } = {}) {
  return apiPost(`/api/reservation/accept-or-decline-reservation/${id}`, { decision, reason });
}

