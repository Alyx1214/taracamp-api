import { apiGet, apiPost } from './api';

export function getAllSpecialServices() {
  return apiGet('/api/special-service/get-all-special-services');
}

export function updateSpecialService(id, { name, price, unit }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (price !== undefined && price !== null && price !== '') body.price = Number(price);
  if (unit !== undefined) body.unit = unit;
  return apiPost(`/api/special-service/update-special-service/${encodeURIComponent(id)}`, body);
}
