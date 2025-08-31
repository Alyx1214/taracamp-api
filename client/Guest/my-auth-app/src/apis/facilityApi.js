
import { apiGet } from './api';

/**
 * @param {'CONFERENCE'|'DORMITORY'|'COTTAGE'|string} type
 */
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
