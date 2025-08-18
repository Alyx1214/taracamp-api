import { Status, UserRole, ReservationStatus, } from '../constants.js';

const dashboardModule = {
    /**
     * Retrieves the count of reservations for the current day.
     * @param {object} user - The user object containing userId and role.
     * @returns {object} Response data with status, error, message, and count on success.
     */
    getTodaysReservationCount: async (dbHelper, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching today\'s reservation count',
        };
        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in.';
                return responseData;
            }

            if (user.role === UserRole.GUEST) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to perform this action.';
                return responseData;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            const reservations = await dbHelper.find('reservation', {
                dateOfArrival: {
                    $gte: today,
                    $lt: tomorrow,
                },
            });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Successfully fetched today\'s reservation count';
            responseData.count = reservations.length;
        } catch (error) {
            console.error('Error fetching today\'s reservation count:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Retrieves the count of check-ins for the current month.
     * @param {object} dbHelper - The database helper for database operations.
     * @param {object} user - The user object containing userId and role.
     * @returns {object} Response data with status, error, message, and count on success.
     */
    getMonthlyCheckInsCount: async (dbHelper, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching monthly check-ins count',
        };

        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in.';
                return responseData;
            }

            if (user.role === UserRole.GUEST) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to perform this action.';
                return responseData;
            }

            const today = new Date();
            const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

            const checkIns = await dbHelper.find('reservation', {
                dateOfArrival: {
                    $gte: firstDayOfCurrentMonth,
                    $lt: firstDayOfNextMonth,
                },
            }, { _id: 1, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Successfully fetched monthly check-ins count';
            responseData.count = checkIns.length;
        } catch (error) {
            console.error('Error fetching monthly check-ins count:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Retrieves the count of confirmed reservations.
     * @param {object} dbHelper - The database helper for database operations.
     * @param {object} user - The user object containing userId and role.
     * @returns {object} Response data with status, error, message, and count on success.
     */
    getConfirmedReservationsCount: async (dbHelper, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching confirmed reservations count',
        };

        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in.';
                return responseData;
            }

            if (user.role === UserRole.GUEST) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to perform this action.';
                return responseData;
            }

            const confirmedReservations = await dbHelper.find('reservation', {
                status: ReservationStatus.CONFIRMED,
            });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Successfully fetched confirmed reservations count';
            responseData.count = confirmedReservations.length;
        } catch (error) {
            console.error('Error fetching confirmed reservations count:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Retrieves the count of pending reservations.
     * @param {object} dbHelper - The database helper for database operations.
     * @param {object} user - The user object containing userId and role.
     * @returns {object} Response data with status, error, message, and count on success.
     */
    getPendingReservationsCount: async (dbHelper, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching pending reservations count',
        };

        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in.';
                return responseData;
            }

            if (user.role === UserRole.GUEST) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to perform this action.';
                return responseData;
            }

            const pendingReservations = await dbHelper.find('reservation', {
                status: ReservationStatus.PENDING,
            });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Successfully fetched pending reservations count';
            responseData.count = pendingReservations.length;
        } catch (error) {
            console.error('Error fetching pending reservations count:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Retrieves the count of cancelled reservations.
     * @param {object} dbHelper - The database helper for database operations.
     * @param {object} user - The user object containing userId and role.
     * @returns {object} Response data with status, error, message, and count on success.
     */
    getCancelledReservationsCount: async (dbHelper, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching cancelled reservations count',
        };

        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in.';
                return responseData;
            }

            if (user.role === UserRole.GUEST) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to perform this action.';
                return responseData;
            }

            const cancelledReservations = await dbHelper.find('reservation', {
                status: ReservationStatus.CANCELLED,
            });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Successfully fetched cancelled reservations count';
            responseData.count = cancelledReservations.length;
        } catch (error) {
            console.error('Error fetching cancelled reservations count:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Retrieves the count of total guest users.
     * @param {object} dbHelper - The database helper for database operations.
     * @param {object} user - The user object containing userId and role.
     * @returns {object} Response data with status, error, message, and count on success.
     */
    getTotalGuestUsers: async (dbHelper, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching total guest users count',
        };

        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in.';
                return responseData;
            }

            if (user.role === UserRole.GUEST) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to perform this action.';
                return responseData;
            }

            const guestUsers = await dbHelper.find('user', {
                role: UserRole.GUEST,
            });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Successfully fetched total guest users count';
            responseData.count = guestUsers.length;
        } catch (error) {
            console.error('Error fetching total guest users count:', error);
            responseData.error = error.message;
        }
        return responseData;
    },
};

export default dashboardModule;
