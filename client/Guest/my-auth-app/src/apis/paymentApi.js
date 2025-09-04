import { apiGet, apiPost } from './api';

export function createPaymentIntent(reservationId, payload = {}) {
  if (!reservationId) throw new Error('reservationId is required');
  return apiPost(`/api/payment/create-payment-intent/${reservationId}`, payload);
}

export function createPaymentMethod({ type, details, billing } = {}) {
  return apiPost('/api/payment/create-payment-method', { type, details, billing });
}

export function attachPaymentMethod({ paymentIntentId, paymentMethodId, returnUrl, paymentMethodType } = {}) {
  return apiPost('/api/payment/attach-payment-method', { paymentIntentId, paymentMethodId, returnUrl, paymentMethodType });
}

export function getPaymentIntent(id) {
  return apiGet(`/api/payment/get-payment-intent/${id}`);
}

export function listPaymentsByReservation(reservationId) {
  if (!reservationId) throw new Error('reservationId is required');
  return apiGet(`/api/payment/list-by-reservation/${reservationId}`);
}

export function reconcilePaymentIntent(id) {
  if (!id) throw new Error('paymentIntentId is required');
  return apiGet(`/api/payment/reconcile/${id}`);
}

export function getPaymentSummary(id) {
  return apiGet(`/api/payment/get-payment-summary/${id}`);
}

