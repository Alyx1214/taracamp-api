import { apiGet, apiPost } from './api';

export function getAllAddons() {
  return apiGet('/addons/get-all-addons');
}

export function updateAddon(id, { name, price, unit }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (price !== undefined && price !== null && price !== '') body.price = Number(price);
  if (unit !== undefined) body.unit = unit;
  return apiPost(`/addons/update-addon/${encodeURIComponent(id)}`, body);
}

export function updateManyAddons(updates) {
  return apiPost('/addons/update-many-addons', { updates });
}

export function searchAddons(params = {}) {
  return apiGet('/addons/search-addons', params);
}

export function createAddon({ name, price, unit }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (price !== undefined && price !== null && price !== '') body.price = Number(price);
  if (unit !== undefined) body.unit = unit;
  return apiPost('/addons/create-addon', body);
}

export function deleteAddon(id) {
  return apiPost(`/addons/delete-addon/${encodeURIComponent(id)}`, {});
}