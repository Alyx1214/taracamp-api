import { apiGet, apiPost } from './api';

export function getFacilitiesByType(type) {
  const t = String(type || '').trim();
  return apiGet(`/facility/get-facilities-by-type/${encodeURIComponent(t)}?includeUnavailable=true`);
}

export function getAllFacilities(options = {}) {
  const params = new URLSearchParams();
  params.append('includeUnavailable', 'true');
  // Request maximum limit to get all facilities (max is 100)
  if (options.limit !== undefined) {
    params.append('limit', String(options.limit));
  } else {
    params.append('limit', '100'); // Request max limit
  }
  if (options.skip !== undefined) {
    params.append('skip', String(options.skip));
  }
  return apiGet(`/facility/get-all-facilities?${params.toString()}`);
}

export function searchFacilities(params = {}) {
  const q = new URLSearchParams();
  const normalized = { ...params };
  if (normalized.type != null) normalized.type = String(normalized.type).trim();
  // Always include unavailable facilities for admin
  normalized.includeUnavailable = true;
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
      fd.append('images', v);
    } else if (k === 'images' && (Array.isArray(v) || (typeof FileList !== 'undefined' && v instanceof FileList))) {
      Array.from(v).forEach((file) => {
        if (file instanceof File) fd.append('images', file);
      });
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
      fd.append('images', v);
    } else if (k === 'images' && (Array.isArray(v) || (typeof FileList !== 'undefined' && v instanceof FileList))) {
      Array.from(v).forEach((file) => {
        if (file instanceof File) fd.append('images', file);
      });
    } else {
      fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  });
  return apiPost(`/facility/update-facility/${encodeURIComponent(id)}`, fd);
}

export function deleteFacility(id) {
  return apiPost(`/facility/delete-facility/${encodeURIComponent(id)}`, {});
}

export function updateRooms(id, roomsData) {
  return apiPost(`/facility/update-rooms/${encodeURIComponent(id)}`, roomsData);
}
