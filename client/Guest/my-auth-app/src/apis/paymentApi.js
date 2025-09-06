import { apiGet, apiPost } from './api';

export function createPaymentIntent(reservationId, payload = {}) {
  if (!reservationId) throw new Error('reservationId is required');
  return apiPost(`/payment/create-payment-intent/${encodeURIComponent(reservationId)}`, payload);
}

export function createPaymentMethod({ type, details, billing } = {}) {
  return apiPost('/payment/create-payment-method', { type, details, billing });
}

export function attachPaymentMethod({ paymentIntentId, paymentMethodId, returnUrl, paymentMethodType } = {}) {
  return apiPost('/payment/attach-payment-method', {
    paymentIntentId,
    paymentMethodId,
    returnUrl,
    paymentMethodType,
  });
}

export function getPaymentIntent(id) {
  return apiGet(`/payment/get-payment-intent/${encodeURIComponent(id)}`);
}

export function listPaymentsByReservation(reservationId) {
  if (!reservationId) throw new Error('reservationId is required');
  return apiGet(`/payment/list-by-reservation/${encodeURIComponent(reservationId)}`);
}

export function reconcilePaymentIntent(id) {
  if (!id) throw new Error('paymentIntentId is required');
  return apiGet(`/payment/reconcile/${encodeURIComponent(id)}`);
}

export function getPaymentSummary(id) {
  return apiGet(`/payment/get-payment-summary/${encodeURIComponent(id)}`);
}
