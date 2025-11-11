import { Status, UserRole } from '../constants.js';

const reviewModule = {
    /**
     * Adds a new review for a facility.
     * @param {Object} dbHelper - The database helper object.
     * @param {Object} data - The review data.
     * @param {Object} user - The authenticated user.
     * @return {Promise<Object>} The response data.
     */
    addReview: async (dbHelper, data, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error adding review',
        };

        try {
            const { facilityId, rating, text, reservationId } = data;

            if (!facilityId || !rating || !text) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing required fields: facilityId, rating, text';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            // Validate facility exists
            const facility = await dbHelper.findOne('facility', { _id: facilityId });
            if (!facility) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Facility not found';
                return responseData;
            }

            // Validate rating structure
            const { location, service, cleanliness, overall } = rating;
            if (!isValidRating(location) || !isValidRating(service) ||
                !isValidRating(cleanliness) || !isValidRating(overall)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid rating values. All ratings must be between 1-10';
                return responseData;
            }

            if (text.length > 1000) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Review text cannot exceed 1000 characters';
                return responseData;
            }

            // Check if user already reviewed this facility
            const existingReview = await dbHelper.findOne('review', {
                facilityId,
                userId: user.userId
            });

            if (existingReview) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'You have already reviewed this facility';
                return responseData;
            }

            // Get user name for review
            const userData = await dbHelper.findOne('user', { _id: user.userId });
            const authorName = userData ? userData.name : 'Anonymous';

            const reviewData = {
                facilityId,
                userId: user.userId,
                rating: {
                    location: Number(location),
                    service: Number(service),
                    cleanliness: Number(cleanliness),
                    overall: Number(overall)
                },
                text: text.trim(),
                authorName,
                reservationId: reservationId || null,
                isVerified: !!reservationId // Mark as verified if linked to reservation
            };

            const review = await dbHelper.create('review', reviewData);

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.message = 'Review added successfully';
            responseData.reviewId = review._id.toString();
        } catch (error) {
            console.error('Error adding review:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error adding review';
        }
        return responseData;
    },

    /**
     * Gets all reviews for a facility.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} facilityId - The facility ID.
     * @param {Object} options - Query options (limit, skip, sort).
     * @param {Object} user - Optional authenticated user (for admin access to hidden reviews).
     * @return {Promise<Object>} The response data.
     */
    getReviewsByFacility: async (dbHelper, facilityId, options = {}, user = null) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching reviews',
            reviews: [],
            averageRatings: null,
            totalReviews: 0
        };

        try {
            if (!facilityId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing facility ID';
                return responseData;
            }

            // Check if user is admin - admins can see hidden reviews
            const isAdmin = user && (user.role === UserRole.CRMSTEAM || user.role === UserRole.SUPERINTENDENT);
            
            // Build query - filter out hidden reviews for non-admins
            const query = { facilityId };
            if (!isAdmin) {
                query.hidden = { $ne: true };
            }

            const { limit = 10, skip = 0, sort = { createdAt: -1 } } = options;

            // Get reviews
            const reviews = await dbHelper.findMany('review',
                query,
                {
                    projection: { __v: 0 },
                    sort: sort,
                    limit: clampLimit(limit),
                    skip: clampSkip(skip)
                }
            );

            // Calculate average ratings - also filter hidden reviews for non-admins
            const allReviewsQuery = { facilityId };
            if (!isAdmin) {
                allReviewsQuery.hidden = { $ne: true };
            }
            const allReviews = await dbHelper.find('review', allReviewsQuery);
            const averageRatings = calculateAverageRatings(allReviews);

            const reviewsWithUserData = reviews.map(review => ({
                id: review._id.toString(),
                text: review.text,
                authorName: review.authorName || 'Anonymous',
                rating: review.rating,
                isVerified: review.isVerified,
                adminReply: review.adminReply || null,
                hidden: review.hidden || false,
                createdAt: review.createdAt
            }));

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.reviews = reviewsWithUserData;
            responseData.averageRatings = averageRatings;
            responseData.totalReviews = allReviews.length;
        } catch (error) {
            console.error('Error fetching reviews:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching reviews';
        }
        return responseData;
    },

    /**
     * Updates an existing review.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} reviewId - The review ID.
     * @param {Object} data - The updated review data.
     * @param {Object} user - The authenticated user.
     * @return {Promise<Object>} The response data.
     */
    updateReview: async (dbHelper, reviewId, data, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error updating review',
        };

        try {
            if (!reviewId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing review ID';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            const review = await dbHelper.findOne('review', { _id: reviewId });
            if (!review) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Review not found';
                return responseData;
            }

            // Check if user owns the review
            if (review.userId.toString() !== user.userId.toString()) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You can only update your own reviews';
                return responseData;
            }

            const updateData = {};

            if (data.rating) {
                const { location, service, cleanliness, overall } = data.rating;
                if (!isValidRating(location) || !isValidRating(service) ||
                    !isValidRating(cleanliness) || !isValidRating(overall)) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid rating values. All ratings must be between 1-10';
                    return responseData;
                }
                updateData.rating = {
                    location: Number(location),
                    service: Number(service),
                    cleanliness: Number(cleanliness),
                    overall: Number(overall)
                };
            }

            if (data.text) {
                if (data.text.length > 1000) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Review text cannot exceed 1000 characters';
                    return responseData;
                }
                updateData.text = data.text.trim();
            }

            updateData.updatedAt = new Date();

            await dbHelper.updateOne('review', { _id: reviewId }, { $set: updateData });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Review updated successfully';
            responseData.reviewId = reviewId;
        } catch (error) {
            console.error('Error updating review:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error updating review';
        }
        return responseData;
    },

    /**
     * Deletes a review.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} reviewId - The review ID.
     * @param {Object} user - The authenticated user.
     * @return {Promise<Object>} The response data.
     */
    deleteReview: async (dbHelper, reviewId, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error deleting review',
        };

        try {
            if (!reviewId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing review ID';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            const review = await dbHelper.findOne('review', { _id: reviewId });
            if (!review) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Review not found';
                return responseData;
            }

            // Check if user owns the review or is admin
            if (review.userId.toString() !== user.userId.toString() &&
                user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You can only delete your own reviews';
                return responseData;
            }

            await dbHelper.deleteOne('review', { _id: reviewId });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Review deleted successfully';
            responseData.reviewId = reviewId;
        } catch (error) {
            console.error('Error deleting review:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error deleting review';
        }
        return responseData;
    },

    /**
     * Gets reviews by user.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} userId - The user ID.
     * @param {Object} options - Query options.
     * @return {Promise<Object>} The response data.
     */
    getReviewsByUser: async (dbHelper, userId, options = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching user reviews',
            reviews: []
        };

        try {
            if (!userId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing user ID';
                return responseData;
            }

            const { limit = 10, skip = 0, sort = { createdAt: -1 } } = options;

            const reviews = await dbHelper.findMany('review',
                { userId },
                {
                    projection: { __v: 0 },
                    sort: sort,
                    limit: clampLimit(limit),
                    skip: clampSkip(skip)
                }
            );

            // Get facility details for each review
            const reviewsWithFacility = await Promise.all(
                reviews.map(async (review) => {
                    const facility = await dbHelper.findOne('facility',
                        { _id: review.facilityId },
                        { name: 1, facilityType: 1 }
                    );

                    return {
                        id: review._id.toString(),
                        text: review.text,
                        rating: review.rating,
                        isVerified: review.isVerified,
                        createdAt: review.createdAt,
                        updatedAt: review.updatedAt,
                        facility: facility ? {
                            id: facility._id.toString(),
                            name: facility.name,
                            type: facility.facilityType
                        } : null
                    };
                })
            );

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.reviews = reviewsWithFacility;
        } catch (error) {
            console.error('Error fetching user reviews:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching user reviews';
        }
        return responseData;
    },

    /**
     * Adds or updates an admin reply to a review.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} reviewId - The review ID.
     * @param {string} replyText - The admin reply text.
     * @param {Object} user - The authenticated user (must be admin).
     * @return {Promise<Object>} The response data.
     */
    addAdminReply: async (dbHelper, reviewId, replyText, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error adding admin reply',
        };

        try {
            if (!reviewId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing review ID';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            // Check if user is admin
            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only admins can add replies to reviews';
                return responseData;
            }

            if (replyText && replyText.length > 1000) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Admin reply cannot exceed 1000 characters';
                return responseData;
            }

            const review = await dbHelper.findOne('review', { _id: reviewId });
            if (!review) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Review not found';
                return responseData;
            }

            const updateData = {
                adminReply: replyText ? replyText.trim() : null,
                updatedAt: new Date()
            };

            await dbHelper.updateOne('review', { _id: reviewId }, { $set: updateData });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = replyText ? 'Admin reply added successfully' : 'Admin reply removed successfully';
            responseData.reviewId = reviewId;
        } catch (error) {
            console.error('Error adding admin reply:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error adding admin reply';
        }
        return responseData;
    },

    /**
     * Toggles the visibility (hidden status) of a review.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} reviewId - The review ID.
     * @param {boolean} hidden - Whether the review should be hidden.
     * @param {Object} user - The authenticated user (must be admin).
     * @return {Promise<Object>} The response data.
     */
    toggleReviewVisibility: async (dbHelper, reviewId, hidden, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error toggling review visibility',
        };

        try {
            if (!reviewId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing review ID';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            // Check if user is admin
            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only admins can toggle review visibility';
                return responseData;
            }

            const review = await dbHelper.findOne('review', { _id: reviewId });
            if (!review) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Review not found';
                return responseData;
            }

            await dbHelper.updateOne('review', { _id: reviewId }, { 
                $set: { 
                    hidden: !!hidden,
                    updatedAt: new Date()
                } 
            });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = hidden ? 'Review hidden successfully' : 'Review unhidden successfully';
            responseData.reviewId = reviewId;
        } catch (error) {
            console.error('Error toggling review visibility:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error toggling review visibility';
        }
        return responseData;
    }
};

export default reviewModule;

// Helper functions
function isValidRating(rating) {
    const num = Number(rating);
    return !isNaN(num) && num >= 1 && num <= 10;
}

function calculateAverageRatings(reviews) {
    if (!reviews || reviews.length === 0) {
        return {
            location: 0,
            service: 0,
            cleanliness: 0,
            overall: 0
        };
    }

    const totals = reviews.reduce((acc, review) => {
        acc.location += review.rating.location;
        acc.service += review.rating.service;
        acc.cleanliness += review.rating.cleanliness;
        acc.overall += review.rating.overall;
        return acc;
    }, { location: 0, service: 0, cleanliness: 0, overall: 0 });

    const count = reviews.length;
    return {
        location: Math.round((totals.location / count) * 10) / 10,
        service: Math.round((totals.service / count) * 10) / 10,
        cleanliness: Math.round((totals.cleanliness / count) * 10) / 10,
        overall: Math.round((totals.overall / count) * 10) / 10
    };
}

function clampLimit(value, def = 10) {
    if (value === null || value === undefined || value === '') return def;
    const n = Number(value);
    if (!Number.isFinite(n)) return def;
    return Math.max(1, Math.min(50, Math.trunc(n)));
}

function clampSkip(value, def = 0) {
    if (value === null || value === undefined || value === '') return def;
    const n = Number(value);
    if (!Number.isFinite(n)) return def;
    return Math.max(0, Math.trunc(n));
}