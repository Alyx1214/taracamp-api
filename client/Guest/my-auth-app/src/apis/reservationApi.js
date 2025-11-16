import { apiGet, apiPost } from './api';

export function getMyReservations() {
  return apiGet('/reservation/get-reservation-by-user-id');
}

export function getReservationById(id) {
  return apiGet(`/reservation/get-reservation-by-id/${encodeURIComponent(id)}`);
}

export function getAllReservationsByStatus(status) {
  return apiGet(`/reservation/get-all-reservations-by-status/${encodeURIComponent(status)}`);
}

/**
 * Get reservations for a specific facility
 * Filters to only return confirmed and approved reservations
 */
export function getReservationsByFacilityId(facilityId) {
  return apiGet(`/reservation/get-reservations-by-facility/${encodeURIComponent(facilityId)}`, {
    status: 'confirmed,approved'
  });
}

export function estimateAmount({ facility, adults, children, pwds, seniorCitizens, serviceType, category, addOns, dateOfArrival, dateOfDeparture, timeOfArrival }) {
  return apiGet('/reservation/estimate-amount', { facility, adults, children, pwds, seniorCitizens, serviceType, category, addOns, dateOfArrival, dateOfDeparture, timeOfArrival });
}

export function checkAvailability(params) {
  return apiGet('/reservation/check-availability', params);
}

export function createReservation(payload = {}, letterOfIntentFile, seniorCitizenIdFiles = [], pwdIdFiles = [], governmentIdFiles = []) {
  const fd = new FormData();

  // Avoid leaking internal IDs and force primitives to strings
  const { letterOfIntentFileId, seniorCitizenIdFileId, pwdIdFileId, governmentIdFileId, ...safe } = payload || {};

  Object.entries(safe).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    // Explicitly ensure facility is a plain string
    if (key === 'facility') {
      fd.append('facility', String(value));
      return;
    }

    // Append arrays as repeated fields (server accepts arrays)
    if (Array.isArray(value)) {
      value.forEach((item) => {
        fd.append(key, String(item));
      });
      return;
    }

    // Files are handled separately; skip here
    if (typeof File !== 'undefined' && value instanceof File) return;
    if (typeof Blob !== 'undefined' && value instanceof Blob) return;

    // Primitives -> strings; objects -> JSON string
    if (typeof value === 'object') {
      fd.append(key, JSON.stringify(value));
    } else {
      fd.append(key, String(value));
    }
  });

  if (letterOfIntentFile) fd.append('letterOfIntentFile', letterOfIntentFile);
  
  if (Array.isArray(seniorCitizenIdFiles)) {
    seniorCitizenIdFiles.forEach((file) => {
      if (file) fd.append('seniorCitizenIdFiles', file);
    });
  } else if (seniorCitizenIdFiles) {
    fd.append('seniorCitizenIdFiles', seniorCitizenIdFiles);
  }
  
  if (Array.isArray(pwdIdFiles)) {
    pwdIdFiles.forEach((file) => {
      if (file) fd.append('pwdIdFiles', file);
    });
  } else if (pwdIdFiles) {
    fd.append('pwdIdFiles', pwdIdFiles);
  }
  
  if (Array.isArray(governmentIdFiles)) {
    governmentIdFiles.forEach((file) => {
      if (file) fd.append('governmentIdFiles', file);
    });
  } else if (governmentIdFiles) {
    fd.append('governmentIdFiles', governmentIdFiles);
  }
  
  return apiPost('/reservation/create-reservation', fd);
}

export function updateReservation(id, payload = {}, letterOfIntentFile) {
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  });
  if (letterOfIntentFile) fd.append('letterOfIntentFile', letterOfIntentFile);
  return apiPost(`/reservation/update-reservation/${encodeURIComponent(id)}`, fd);
}

export function cancelReservation(id) {
  return apiPost(`/reservation/cancel-booking/${encodeURIComponent(id)}`, {});
}

export function updateMealPreference(reservationId, willAvailMeals) {
  return apiPost(`/reservation/update-meal-preference/${encodeURIComponent(reservationId)}`, { willAvailMeals });
}

export function decideReservation(id, { decision, reason } = {}) {
  return apiPost(`/reservation/accept-or-decline-reservation/${encodeURIComponent(id)}`, { decision, reason });
}

export function uploadConfirmationDocuments(id, moaFile, serviceContractFile, fundsFile) {
  const fd = new FormData();
  
  // Upload MOA file as separate field
  if (moaFile) {
    console.log('Adding MOA file:', moaFile.name, moaFile.size, moaFile.type);
    fd.append('moaFile', moaFile);
  }
  
  // Upload Service Contract file
  if (serviceContractFile) {
    console.log('Adding Service Contract file:', serviceContractFile.name, serviceContractFile.size, serviceContractFile.type);
    fd.append('serviceContractFile', serviceContractFile);
  }
  
  // Upload Certificate of Availability of Funds file
  if (fundsFile) {
    console.log('Adding Certificate of Availability of Funds file:', fundsFile.name, fundsFile.size, fundsFile.type);
    fd.append('fundsFile', fundsFile);
  }
  
  // Set status to Confirmed after uploading documents
  fd.append('status', 'Confirmed');
  
  console.log('FormData entries:', Array.from(fd.entries()).map(([key, value]) => [key, value instanceof File ? `${value.name} (${value.size} bytes)` : value]));
  
  return apiPost(`/reservation/update-reservation/${encodeURIComponent(id)}`, fd);
}

