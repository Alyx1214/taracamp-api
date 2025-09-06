import { apiGet, apiPost } from './api';

export function getFacilitiesByType(type) {
  const t = String(type || '').trim().toUpperCase();
  return apiGet(`/facility/get-facilities-by-type/${encodeURIComponent(t)}`);
}

export function getAllFacilities() {
  return apiGet('/facility/get-all-facilities');
}

export function searchFacilities(params = {}) {
  const q = new URLSearchParams();
  const normalized = { ...params };
  if (normalized.type != null) normalized.type = String(normalized.type).trim().toUpperCase();
  Object.entries(normalized).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') q.append(k, v);
  });
  return apiGet(`/facility/search-facilities?${q.toString()}`);
}

export function getFacilityById(id) {
  return apiGet(`/facility/get-facility-by-id/${encodeURIComponent(id)}`);
}

export function getAvailableDatesByFacility(id) {
  return apiGet(`/facility/get-available-dates-by-facility/${encodeURIComponent(id)}`);
}

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
  return apiPost('/facility/create-facility', fd);
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
  return apiPost(`/facility/update-facility/${encodeURIComponent(id)}`, fd);
}

export function deleteFacility(id) {
  return apiPost(`/facility/delete-facility/${encodeURIComponent(id)}`, {});
}
