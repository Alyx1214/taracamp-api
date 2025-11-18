import { apiGet, apiPost } from './api';

export function getPaymentDetails(reservationId) {
  if (!reservationId) throw new Error('reservationId is required');
  return apiGet(`/payment/get-payment-details/${encodeURIComponent(reservationId)}`);
}

export function getTransactionDetails(reservationId) {
  if (!reservationId) throw new Error('reservationId is required');
  return apiGet(`/payment/get-transaction-details/${encodeURIComponent(reservationId)}`);
}

export function listPaymentsForReservation(reservationId) {
  if (!reservationId) throw new Error("reservationId is required");
  return apiGet(`/payment/list-by-reservation/${encodeURIComponent(reservationId)}`);
  
}

export function getPaymentSummary(reservationId) {
  if (!reservationId) throw new Error("reservationId is required");
  return apiGet(`/payment/get-payment-summary/${encodeURIComponent(reservationId)}`);
}

export async function updatePaymentStatus(reservationId, data) {
  return apiPost(`/payment/update-payment-status/${encodeURIComponent(reservationId)}`, data);
}

export async function uploadInvoice(reservationId, file) {
  const fd = new FormData();
  fd.append('invoice', file);
  return apiPost(`/payment/upload-invoice/${encodeURIComponent(reservationId)}`, fd);
}

