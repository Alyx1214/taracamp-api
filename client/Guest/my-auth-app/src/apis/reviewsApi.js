import { apiGet, apiPost } from './api';

export function getReviewsByFacilityId(facilityId) {
    return apiGet(`/reviews/get-reviews-by-facility-id/${encodeURIComponent(facilityId)}`);
}

export function addReview(data) {
    return apiPost('/reviews/add-review', data);
}
