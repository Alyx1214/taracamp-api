import { apiGet } from './api';

export function searchSpecialServices(params = {}) {
  return apiGet('/special-service/search-special-services', params);
}

export function getAllSpecialServices() {
  return apiGet('/special-service/get-all-special-services');
}
