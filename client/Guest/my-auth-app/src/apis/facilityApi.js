import { apiGet } from './api';

export function getFacilitiesByType(type) {
  const t = String(type || '').trim();
  return apiGet(`/facility/get-facilities-by-type/${encodeURIComponent(t)}`);
}

export function getAllFacilities() {
  return apiGet('/facility/get-all-facilities');
}

export function searchFacilities(params = {}) {
  const normalized = { ...params };
  if (normalized.type != null) {
    normalized.type = String(normalized.type).trim();
  }
  return apiGet('/facility/search-facilities', normalized);
}

export function getFacilityById(id) {
  return apiGet(`/facility/get-facility-by-id/${encodeURIComponent(id)}`);
}

export function getUnavailableDatesByFacility(id) {
  return apiGet(`/facility/get-unavailable-dates-by-facility/${encodeURIComponent(id)}`);
}
