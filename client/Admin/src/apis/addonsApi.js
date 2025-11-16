import { apiGet, apiPost } from './api';

export function getAllAddons() {
  return apiGet('/addons/get-all-addons');
}

export function updateAddon(id, { name, price, unit, serviceType }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (price !== undefined && price !== null && price !== '') body.price = Number(price);
  if (unit !== undefined) body.unit = unit;
  if (serviceType !== undefined && serviceType !== null && serviceType !== '') body.serviceType = serviceType;
  return apiPost(`/addons/update-addon/${encodeURIComponent(id)}`, body);
}

export function updateManyAddons(updates) {
  return apiPost('/addons/update-many-addons', { updates });
}

export function searchAddons(params = {}) {
  return apiGet('/addons/search-addons', params);
}

export function createAddon({ name, price, unit, serviceType }) {
  const body = {};
  if (name !== undefined && name !== null && name !== '') body.name = name;
  if (price !== undefined && price !== null && price !== '') body.price = Number(price);
  if (unit !== undefined && unit !== null && unit !== '') body.unit = unit;
  // Include serviceType if provided and not empty
  if (serviceType !== undefined && serviceType !== null && serviceType !== '') {
    body.serviceType = serviceType;
  }
  return apiPost('/addons/create-addon', body);
}

export function deleteAddon(id) {
  return apiPost(`/addons/delete-addon/${encodeURIComponent(id)}`, {});
}