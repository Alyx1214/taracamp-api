import { apiGet, apiPost } from './api';

const TYPE_MAP = {
  Dormitory: 'DORMITORY',
  Cottages: 'COTTAGE',
  Conference: 'CONFERENCE',
};

export function getFacilitiesByType(labelOrType) {
  const type = TYPE_MAP[labelOrType] || String(labelOrType || '').toUpperCase();
  return apiGet(`/api/facility/get-facilities-by-type/${encodeURIComponent(type)}`);
}

export function createFacility({ name, facilityType, capacity, ratePerPerson, price, status, image }) {
  const fd = new FormData();
  if (name) fd.append('name', name);
  if (facilityType) fd.append('facilityType', facilityType);
  if (capacity !== undefined && capacity !== null && capacity !== '') fd.append('capacity', String(capacity));
  if (ratePerPerson !== undefined && ratePerPerson !== null && ratePerPerson !== '') fd.append('ratePerPerson', String(ratePerPerson));
  if (price !== undefined && price !== null && price !== '') fd.append('price', String(price));
  if (status) fd.append('status', status);
  if (image) fd.append('image', image);
  return apiPost('/api/facility/create-facility', fd);
}

export function deleteFacility(id) {
  return apiPost(`/api/facility/delete-facility/${encodeURIComponent(id)}`);
}

export function updateFacility(id, { name, facilityType, capacity, ratePerPerson, price, status, image }) {
  const fd = new FormData();
  if (name !== undefined) fd.append('name', name);
  if (facilityType) fd.append('facilityType', facilityType);
  if (capacity !== undefined && capacity !== null && capacity !== '') fd.append('capacity', String(capacity));
  if (ratePerPerson !== undefined && ratePerPerson !== null && ratePerPerson !== '') fd.append('ratePerPerson', String(ratePerPerson));
  if (price !== undefined && price !== null && price !== '') fd.append('price', String(price));
  if (status) fd.append('status', status);
  if (image) fd.append('image', image);
  return apiPost(`/api/facility/update-facility/${encodeURIComponent(id)}`, fd);
}
