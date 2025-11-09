import { Status, UserRole, ReservationStatus, } from '../constants.js';

// Enhanced in-memory cache for dashboard stats
const cache = {
    dashboardStats: null,
    monthlyReservations: new Map(),
    calendarReservations: new Map(),
    cacheExpiry: 1 * 60 * 1000,
    maxCacheSize: 50,
};

const isCacheValid = (timestamp) => {
    return timestamp && (Date.now() - timestamp) < cache.cacheExpiry;
};

const manageCacheSize = () => {
    const totalCacheSize = cache.monthlyReservations.size + cache.calendarReservations.size;
    if (totalCacheSize > cache.maxCacheSize) {
        const entriesToRemove = totalCacheSize - cache.maxCacheSize;
        
        if (cache.monthlyReservations.size > 0) {
            const monthlyKeysToRemove = Array.from(cache.monthlyReservations.keys()).slice(0, Math.min(entriesToRemove, cache.monthlyReservations.size));
            monthlyKeysToRemove.forEach(key => cache.monthlyReservations.delete(key));
        }
        
        const remainingToRemove = entriesToRemove - Math.min(entriesToRemove, cache.monthlyReservations.size);
        if (remainingToRemove > 0 && cache.calendarReservations.size > 0) {
            const calendarKeysToRemove = Array.from(cache.calendarReservations.keys()).slice(0, remainingToRemove);
            calendarKeysToRemove.forEach(key => cache.calendarReservations.delete(key));
        }
    }
};

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

            if (isCacheValid(cache.dashboardStats?.timestamp)) {
                responseData.status = Status.OK;
                responseData.error = null;
                responseData.stats = cache.dashboardStats.data;
                return responseData;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            const [reservationStats, totalGuestUsers] = await Promise.all([
                dbHelper.aggregate('reservation', [
                    {
                        $facet: {
                            todaysReservations: [
                                {
                                    $match: {
                                        dateOfArrival: {
                                            $gte: today,
                                            $lt: tomorrow,
                                        },
                                    },
                                },
                                { $count: 'count' },
                            ],
                            monthlyCheckIns: [
                                {
                                    $match: {
                                        dateOfArrival: {
                                            $gte: firstDayOfCurrentMonth,
                                            $lte: today,
                                        },
                                        status: ReservationStatus.CHECKED_IN,
                                    },
                                },
                                { $count: 'count' },
                            ],
                            confirmedReservations: [
                                {
                                    $match: {
                                        status: ReservationStatus.CONFIRMED,
                                    },
                                },
                                { $count: 'count' },
                            ],
                            pendingReservations: [
                                {
                                    $match: {
                                        status: ReservationStatus.PENDING,
                                    },
                                },
                                { $count: 'count' },
                            ],
                            cancelledReservations: [
                                {
                                    $match: {
                                        status: ReservationStatus.CANCELLED,
                                    },
                                },
                                { $count: 'count' },
                            ],
                        },
                    },
                ]),
                dbHelper.count('user', {
                    role: UserRole.GUEST,
                }),
            ]);

            const stats = reservationStats[0];
            const statsData = {
                todaysReservations: stats.todaysReservations[0]?.count || 0,
                monthlyCheckIns: stats.monthlyCheckIns[0]?.count || 0,
                confirmedReservations: stats.confirmedReservations[0]?.count || 0,
                totalGuestUsers,
                pendingReservations: stats.pendingReservations[0]?.count || 0,
                cancelledReservations: stats.cancelledReservations[0]?.count || 0,
            };

            cache.dashboardStats = {
                data: statsData,
                timestamp: Date.now(),
            };

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.stats = statsData;
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

            const currentYear = year && !isNaN(year) && year > 1900 && year < 2100 ? year : new Date().getFullYear();
            const cacheKey = `monthly_${currentYear}`;
            
            const cachedData = cache.monthlyReservations.get(cacheKey);
            if (cachedData && isCacheValid(cachedData.timestamp)) {
                responseData.status = Status.OK;
                responseData.error = null;
                responseData.message = 'Successfully fetched monthly reservations';
                responseData.data = cachedData.data;
                return responseData;
            }

            const startOfYear = new Date(currentYear, 0, 1);
            const endOfYear = new Date(currentYear + 1, 0, 1);

            const results = await dbHelper.aggregate('reservation', [
                {
                    $match: {
                        dateOfArrival: {
                            $gte: startOfYear,
                            $lt: endOfYear,
                        },
                        status: {
                            $in: [
                                ReservationStatus.CONFIRMED,
                                ReservationStatus.CHECKED_OUT,
                                ReservationStatus.CANCELLED
                            ]
                        }
                    },
                },
                {
                    $addFields: {
                        month: { $month: '$dateOfArrival' },
                        isConfirmed: {
                            $in: ['$status', [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_OUT]]
                        },
                        isCancelled: { $eq: ['$status', ReservationStatus.CANCELLED] }
                    },
                },
                {
                    $group: {
                        _id: '$month',
                        confirmed: { $sum: { $cond: ['$isConfirmed', 1, 0] } },
                        cancelled: { $sum: { $cond: ['$isCancelled', 1, 0] } }
                    },
                },
                {
                    $sort: { _id: 1 },
                },
            ]);

            const confirmed = new Array(12).fill(0);
            const cancelled = new Array(12).fill(0);

            for (const { _id: month, confirmed: confCount, cancelled: cancCount } of results) {
                const monthIndex = month - 1;
                confirmed[monthIndex] = confCount;
                cancelled[monthIndex] = cancCount;
            }

            const data = { confirmed, cancelled };

            cache.monthlyReservations.set(cacheKey, {
                data,
                timestamp: Date.now(),
            });
            
            manageCacheSize();

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Successfully fetched monthly reservations';
            responseData.data = data;

        } catch (error) {
            console.error('Error fetching monthly reservations:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching monthly reservations';
        }

        return responseData;
    },

    /**
     * Retrieves all reservations for a given month with optimized performance.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} user - The user object containing the user ID and role.
     * @param {number} year - The year for which to fetch the reservations.
     * @param {number} month - The month for which to fetch the reservations (1-indexed).
     * @returns {Object} Response data with status, error, message, and an array of reservations with their date of arrival and status.
     */
    getReservationsForCalendar: async (dbHelper, user, year, month) => {
        const responseData = { 
            status: Status.INTERNAL_SERVER_ERROR, 
            error: 'Error fetching reservations for calendar' 
        };

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

            if (isNaN(year) || year < 1900 || year > 2100) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid year parameter.';
                return responseData;
            }

            if (isNaN(month) || month < 1 || month > 12) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid month parameter.';
                return responseData;
            }

            const cacheKey = `calendar_${year}_${month}`;
            const cachedData = cache.calendarReservations.get(cacheKey);
            if (cachedData && isCacheValid(cachedData.timestamp)) {
                responseData.status = Status.OK;
                responseData.error = null;
                responseData.message = 'Successfully fetched reservations for calendar (cached)';
                responseData.reservations = cachedData.data;
                return responseData;
            }

            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 1);

            const reservations = await dbHelper.aggregate('reservation', [
                {
                    $match: {
                        // Include reservations that overlap the month (not just start in it)
                        dateOfArrival: { $lt: endDate },
                        dateOfDeparture: { $gte: startDate },
                        // Exclude Pending, Declined, and Cancelled reservations
                        status: { 
                            $nin: [
                                ReservationStatus.PENDING,
                                ReservationStatus.DECLINED,
                                ReservationStatus.CANCELLED
                            ]
                        }
                    }
                },
                {
                    // Normalize facility id to ObjectId for lookup
                    $addFields: {
                        facilityIdForLookup: {
                            $cond: [
                                { $eq: [{ $type: '$facility' }, 'string'] },
                                { $toObjectId: '$facility' },
                                '$facility'
                            ]
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'facilities',
                        localField: 'facilityIdForLookup',
                        foreignField: '_id',
                        as: 'facility'
                    }
                },
                {
                    $unwind: {
                        path: '$facility',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        dateOfArrival: 1,
                        dateOfDeparture: 1,
                        status: 1,
                        facility: {
                            name: { $ifNull: ['$facility.name', null] }
                        },
                        facilityName: 1,
                        _id: 0
                    }
                },
                {
                    $addFields: {
                        dateOfArrival: { $dateToString: { 
                            format: "%Y-%m-%dT%H:%M:%S.%LZ", 
                            date: "$dateOfArrival" 
                        }},
                        dateOfDeparture: { $dateToString: { 
                            format: "%Y-%m-%dT%H:%M:%S.%LZ", 
                            date: "$dateOfDeparture" 
                        }}
                    }
                }
            ]);

            cache.calendarReservations.set(cacheKey, {
                data: reservations,
                timestamp: Date.now(),
            });
            
            manageCacheSize();

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
    
    clearCache: () => {
        cache.dashboardStats = null;
        cache.monthlyReservations.clear();
        cache.calendarReservations.clear();
    },

};

export default dashboardModule;
