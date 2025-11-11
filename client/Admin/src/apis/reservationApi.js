import { apiGet, apiPost } from './api';

export function getReservationById(id) {
  return apiGet(`/reservation/get-reservation-by-id/${id}`);
}

// Helper function to map frontend sortBy values to backend sort format
function mapSortBy(sortBy) {
  if (!sortBy) return '';
  const sortMap = {
    'date-asc': 'dateOfArrival:asc',
    'date-desc': 'dateOfArrival:desc',
    'service': 'serviceType:asc',
    'category': 'category:asc'
  };
  return sortMap[sortBy] || sortBy;
}

export function getAllReservationsByStatus(status, options = {}) {
  const { limit = 15, skip = 0, sort, sortBy, serviceType, category, startDate, endDate } = options;
  const query = { limit, skip };
  // Use sortBy if provided, otherwise use sort
  const sortValue = sortBy ? mapSortBy(sortBy) : sort;
  if (sortValue) query.sort = sortValue;
  if (serviceType && serviceType.trim()) query.serviceType = serviceType;
  if (category && category.trim()) query.category = category;
  if (startDate && startDate.trim()) query.startDate = startDate;
  if (endDate && endDate.trim()) query.endDate = endDate;
  return apiGet(`/reservation/get-all-reservations-by-status/${encodeURIComponent(status)}`, query);
}

export function searchReservations(params = {}) {
  const p = { ...params };
  if (p.search && !p.query) {
    p.query = p.search;
    delete p.search;
  }
  // Add default pagination if not provided
  if (p.limit === undefined) p.limit = 15;
  if (p.skip === undefined) p.skip = 0;
  // Map filter names to API parameter names
  if (p.startDate && !p.start) p.start = p.startDate;
  if (p.endDate && !p.end) p.end = p.endDate;
  // Map sortBy to sort format
  if (p.sortBy && !p.sort) {
    p.sort = mapSortBy(p.sortBy);
    delete p.sortBy;
  }
  return apiGet('/reservation/search-reservations', p);
}

export function estimateAmount({ facility, adults, children, pwds, seniorCitizens, serviceType, addOns }) {
  const params = { facility, adults, children, pwds, seniorCitizens, serviceType };
  if (addOns && Array.isArray(addOns) && addOns.length > 0) {
    params.addOns = addOns;
  }
  return apiGet('/reservation/estimate-amount', params);
}

export function checkAvailability(params) {
  return apiGet('/reservation/check-availability', params);
}

export function createReservation(payload = {}, letterOfIntentFile, seniorCitizenIdFiles = [], pwdIdFiles = []) {
  const fd = new FormData();

  // Avoid leaking internal IDs and force primitives to strings
  const { letterOfIntentFileId, seniorCitizenIdFileId, pwdIdFileId, ...safe } = payload || {};

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

  // Handle Letter of Intent file (single file)
  if (letterOfIntentFile) fd.append('letterOfIntentFile', letterOfIntentFile);
  
  // Handle Senior Citizen ID files (multiple files)
  if (Array.isArray(seniorCitizenIdFiles)) {
    seniorCitizenIdFiles.forEach((file) => {
      if (file) fd.append('seniorCitizenIdFiles', file);
    });
  } else if (seniorCitizenIdFiles) {
    // Backward compatibility: single file
    fd.append('seniorCitizenIdFiles', seniorCitizenIdFiles);
  }
  
  // Handle PWD ID files (multiple files)
  if (Array.isArray(pwdIdFiles)) {
    pwdIdFiles.forEach((file) => {
      if (file) fd.append('pwdIdFiles', file);
    });
  } else if (pwdIdFiles) {
    // Backward compatibility: single file
    fd.append('pwdIdFiles', pwdIdFiles);
  }
  
  return apiPost('/reservation/create-reservation', fd);
}

export function updateReservation(id, payload = {}, letterOfIntentFile, seniorCitizenIdFiles = [], pwdIdFiles = []) {
  const fd = new FormData();

  // Avoid leaking internal IDs and force primitives to strings
  const { letterOfIntentFileId, seniorCitizenIdFileId, pwdIdFileId, ...safe } = payload || {};

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

  // Handle Letter of Intent file (single file)
  if (letterOfIntentFile) fd.append('letterOfIntentFile', letterOfIntentFile);
  
  // Handle Senior Citizen ID files (multiple files)
  if (Array.isArray(seniorCitizenIdFiles)) {
    seniorCitizenIdFiles.forEach((file) => {
      if (file) fd.append('seniorCitizenIdFiles', file);
    });
  } else if (seniorCitizenIdFiles) {
    // Backward compatibility: single file
    fd.append('seniorCitizenIdFiles', seniorCitizenIdFiles);
  }
  
  // Handle PWD ID files (multiple files)
  if (Array.isArray(pwdIdFiles)) {
    pwdIdFiles.forEach((file) => {
      if (file) fd.append('pwdIdFiles', file);
    });
  } else if (pwdIdFiles) {
    // Backward compatibility: single file
    fd.append('pwdIdFiles', pwdIdFiles);
  }
  
  return apiPost(`/reservation/update-reservation/${id}`, fd);
}

export function deleteReservation(id) {
  return apiPost(`/reservation/delete-reservation/${id}`, {});
}

export function cancelReservation(id) {
  return apiPost(`/reservation/cancel-booking/${id}`, {});
}

export function uploadNonavailabilityCertificate(id, file) {
  const fd = new FormData();
  fd.append('nonavailabilityCertFile', file);
  return apiPost(`/reservation/upload-nonavailability-certificate/${id}`, fd);
}

export function decideReservation(id, decisionOrPayload = {}) {
  const body = typeof decisionOrPayload === 'string'
    ? { status: decisionOrPayload }
    : decisionOrPayload;
  return apiPost(`/reservation/accept-or-decline-reservation/${id}`, body);
}

export function checkInOrCheckOutReservation(id, status) {
  return apiPost(`/reservation/checkin-or-checkout-reservation/${id}`, { status });
}
