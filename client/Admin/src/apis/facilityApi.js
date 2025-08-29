import { apiGet, apiPost } from './api';

export function getFacilitiesByType(type) {
  const t = String(type || '').trim().toUpperCase();
  return apiGet(`/api/facility/get-facilities-by-type/${encodeURIComponent(t)}`);
}

export function getAllFacilities() {
  return apiGet('/api/facility/get-all-facilities');
}

export function searchFacilities(params = {}) {
  const q = new URLSearchParams();
  const normalized = { ...params };
  if (normalized.type != null) normalized.type = String(normalized.type).trim().toUpperCase();
  Object.entries(normalized).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') q.append(k, v);
  });
  return apiGet(`/api/facility/search-facilities?${q.toString()}`);
}

export function searchSpecialServices(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') q.append(k, v);
  });
  return apiGet(`/api/special-service/search-special-services?${q.toString()}`);
}

export function getAllSpecialServices() {
  return apiGet('/api/special-service/get-all-special-services');
}

export function getFacilityById(id) {
  return apiGet(`/api/facility/get-facility-by-id/${encodeURIComponent(id)}`);
}

export function getAvailableDatesByFacility(id) {
  return apiGet(`/api/facility/get-available-dates-by-facility/${encodeURIComponent(id)}`);
}

export function checkAvailability(params) {
  return apiGet('/api/reservation/check-availability', params);
}

// Admin-only: create/update/delete facility
export function createFacility(payload = {}) {
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === 'image' && v instanceof File) {
      fd.append('image', v);
    } else {
      fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  });
  return apiPost('/api/facility/create-facility', fd);
}

export function updateFacility(id, payload = {}) {
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === 'image' && v instanceof File) {
      fd.append('image', v);
    } else {
      fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  });
  return apiPost(`/api/facility/update-facility/${encodeURIComponent(id)}`, fd);
}

export function deleteFacility(id) {
  return apiPost(`/api/facility/delete-facility/${encodeURIComponent(id)}`, {});
}
