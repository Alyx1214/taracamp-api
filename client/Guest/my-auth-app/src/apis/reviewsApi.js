import { apiGet } from './api';

export function getReviewsByFacilityId(facilityId) {
    return apiGet(`/reviews/get-reviews-by-facility-id/${encodeURIComponent(facilityId)}`);
}
