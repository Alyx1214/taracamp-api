import { apiGet } from './api';

/**
 * @param {'CONFERENCE'|'DORMITORY'|'COTTAGE'|string} type
 */
export function getFacilitiesByType(type) {
  const t = String(type || '').trim().toUpperCase();
  return apiGet(`/facility/get-facilities-by-type/${encodeURIComponent(t)}`);
}

export function getAllFacilities() {
  return apiGet('/facility/get-all-facilities');
}

export function searchFacilities(params = {}) {
  const normalized = { ...params };
  if (normalized.type != null) {
    normalized.type = String(normalized.type).trim().toUpperCase();
  }
  return apiGet('/facility/search-facilities', normalized);
}

export function getFacilityById(id) {
  return apiGet(`/facility/get-facility-by-id/${encodeURIComponent(id)}`);
}

export function getAvailableDatesByFacility(id) {
  return apiGet(`/facility/get-available-dates-by-facility/${encodeURIComponent(id)}`);
}
