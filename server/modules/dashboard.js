import { Status, UserRole, ReservationStatus, } from '../constants.js';

const dashboardModule = {
    /**
     * Fetches dashboard statistics.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and stats on success.
     * @property {number} todaysReservations - Count of reservations for today.
     * @property {number} monthlyCheckIns - Count of checkins for the month.
     * @property {number} confirmedReservations - Count of confirmed reservations.
     * @property {number} totalGuestUsers - Count of guest users.
     * @property {number} pendingReservations - Count of pending reservations.
     * @property {number} cancelledReservations - Count of cancelled reservations.
     */
    getDashboardStats: async (dbHelper, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching dashboard stats',
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

            const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            const [
                todaysReservations,
                monthlyCheckIns,
                confirmedReservations,
                totalGuestUsers,
                pendingReservations,
                cancelledReservations,
            ] = await Promise.all([
                dbHelper.count('reservation', {
                    dateOfArrival: {
                        $gte: today,
                        $lt: tomorrow,
                    },
                }),
                dbHelper.count('reservation', {
                    dateOfArrival: {
                        $gte: firstDayOfCurrentMonth,
                        $lte: today,
                    },
                    status: ReservationStatus.CHECKED_IN,
                }),
                dbHelper.count('reservation', {
                    status: ReservationStatus.CONFIRMED,
                }),
                dbHelper.count('user', {
                    role: UserRole.GUEST,
                }),
                dbHelper.count('reservation', {
                    status: ReservationStatus.PENDING,
                }),
                dbHelper.count('reservation', {
                    status: ReservationStatus.CANCELLED,
                }),
            ]);

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.stats = {
                todaysReservations,
                monthlyCheckIns,
                confirmedReservations,
                totalGuestUsers,
                pendingReservations,
                cancelledReservations,
            };
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching dashboard stats';
        }
        return responseData;
    },

    /**
     * Fetches the count of confirmed and cancelled reservations for each month of a given year.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} user - The user object containing the user ID and role.
     * @param {number} year - The year for which to fetch the reservations (defaults to the current year).
     * @returns {Object} Response data with status, error, message, and the counts of confirmed and cancelled reservations for each month.
     */
    getMonthlyReservations: async (dbHelper, user, year) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching monthly reservations',
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

            const confirmed = new Array(12).fill(0);
            const cancelled = new Array(12).fill(0);
            const currentYear = year || new Date().getFullYear();

            for (let month = 0; month < 12; month++) {
                const startDate = new Date(currentYear, month, 1);
                const endDate = new Date(currentYear, month + 1, 1);

                const confirmedCount = await dbHelper.count('reservation', {
                    status: { $in: [ReservationStatus.CHECKED_OUT, ReservationStatus.CONFIRMED] },
                    dateOfArrival: {
                        $gte: startDate,
                        $lt: endDate,
                    },
                });

                const cancelledCount = await dbHelper.count('reservation', {
                    status: ReservationStatus.CANCELLED,
                    dateOfArrival: {
                        $gte: startDate,
                        $lt: endDate,
                    },
                });

                confirmed[month] = confirmedCount;
                cancelled[month] = cancelledCount;
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Successfully fetched monthly reservations';
            responseData.data = { confirmed, cancelled };

        } catch (error) {
            console.error('Error fetching monthly reservations:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching monthly reservations';
        }

        return responseData;
    },

    /**
     * Retrieves all reservations for a given month.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} user - The user object containing the user ID and role.
     * @param {number} year - The year for which to fetch the reservations.
     * @param {number} month - The month for which to fetch the reservations (1-indexed).
     * @returns {Object} Response data with status, error, message, and an array of reservations with their date of arrival and status.
     */
    // modules/dashboard.js -> in dashboardModule.getReservationsForCalendar
    getReservationsForCalendar: async (dbHelper, user, year, month) => {
    const responseData = { status: Status.INTERNAL_SERVER_ERROR, error: 'Error fetching reservations for calendar' };

    try {
        if (!user?.userId) {
        responseData.status = Status.UNAUTHORIZED;
        responseData.error = 'User not logged in.';
        return responseData;
        }

        if (user.role === UserRole.GUEST) {
        responseData.status = Status.FORBIDDEN;
        responseData.error = 'You are not authorized to perform this action.';
        return responseData;
        }

        if (!year || !month) {
        responseData.status = Status.BAD_REQUEST;
        responseData.error = 'Year and month are required.';
        return responseData;
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 1);

        const rows = await dbHelper.find(
        'reservation',
        { dateOfArrival: { $gte: startDate, $lt: endDate } }
        );

        const reservations = (rows || [])
        .filter(r => r?.dateOfArrival)
        .map(r => ({
            dateOfArrival: new Date(r.dateOfArrival).toISOString(),
            status: r.status || null
        }));

        responseData.status = Status.OK;
        responseData.error = null;
        responseData.message = 'Successfully fetched reservations for calendar';
        responseData.reservations = reservations;
        return responseData;
    } catch (error) {
        console.error('Error fetching reservations for calendar:', error);
        responseData.status = Status.INTERNAL_SERVER_ERROR;
        responseData.error = 'Error fetching reservations for calendar';
        return responseData;
    }
    },

};

export default dashboardModule;
