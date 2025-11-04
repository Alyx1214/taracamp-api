import { Status } from '../constants.js';

const notificationModule = {
    /**
   * Creates a new notification for a user and sends it via WebSocket if the user is online.
   * @param {Object} dbHelper - The database helper for database operations.
   * @param {Object} data - The notification data.
   * @param {Object} userSocketMap - The map of user sockets.
   * @returns {Object} The newly created notification.
   */
    createAndNotifyUser: async (dbHelper, data, userSocketMap) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error creating notification',
        };
        try {
            const { title, message, kind, userId, reservationId, } = data;

            // Ensure userId is a string (Map keys must match exactly)
            const userIdStr = userId?.toString?.() || String(userId || '');
            const reservationIdStr = reservationId?.toString?.() || String(reservationId || null);

            const doc = {
                title,
                isRead: false,
                userId: userIdStr,
                reservationId: reservationIdStr || null,
                createdAt: new Date(),
            };

            if (message !== undefined && message !== null) {
                doc.message = message;
            }

            if (kind) {
                doc.kind = kind;
            }

            const saved = await dbHelper.create('notification', doc);

            const userWs = userSocketMap?.get(userIdStr);
            if (userWs && userWs.readyState === 1) {
                userWs.send(JSON.stringify({
                    type: 'notification',
                    notification: {
                        id: saved.id || saved._id?.toString?.() || saved._id,
                        title: doc.title,
                        message: doc.message ?? null,
                        kind: doc.kind ?? null,
                        createdAt: doc.createdAt,
                        isRead: false,
                        source: "Teachers' Camp",
                        time: 'now',
                        reservationId: doc.reservationId || null,
                    },
                }));
            }
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = saved;
        } catch (error) {
            console.error('Error creating notification:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error creating notification';
        }
        return responseData;
    },

    /**
   * Lists notifications for a given user.
   * @param {Object} dbHelper - The database helper for database operations.
   * @param {string} userId - The ID of the user.
   * @param {Object} options - The options for the query.
   * @param {number} options.limit - The maximum number of notifications to return. Defaults to 20.
   * @param {string} options.before - The date before which notifications should be returned. If not set, all notifications are returned.
   * @returns {Object[]} The list of notifications.
   */
    listForUser: async (dbHelper, userId, { limit = 20, before, } = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error listing notifications',
        };
        try {
            const query = { userId, };
            if (before) query.createdAt = { $lt: new Date(before), };

            const rows = await dbHelper.findMany('notification', query, {
                sort: { createdAt: -1, },
                limit: Math.min(Number(limit) || 20, 100),
            });
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = rows;
        } catch (error) {
            console.error('Error listing notifications:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error listing notifications';
        }
        return responseData;
    },

    /**
   * Marks a notification as read.
   * @param {Object} dbHelper - The database helper for database operations.
   * @param {string} notifId - The ID of the notification to mark as read.
   * @param {string} userId - The ID of the user that the notification belongs to.
   * @returns {Object} The modified notification.
   */
    markRead: async (dbHelper, notifId, userId) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error marking notification as read',
        };
        try {
            const result = await dbHelper.updateOne('notification', { _id: notifId, userId, }, { $set: { isRead: true, }, });
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = result;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error marking notification as read';
        }
        return responseData;
    },

    /**
   * Marks all notifications for a given user as read.
   * @param {Object} dbHelper - The database helper for database operations.
   * @param {string} userId - The ID of the user that the notifications belong to.
   * @returns {Object} The modified notifications.
   */
    markAllRead: async (dbHelper, userId) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error marking all notifications as read',
        };
        try {
            const result = await dbHelper.updateMany('notification', { userId, isRead: { $ne: true, }, }, { $set: { isRead: true, }, });
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = result;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error marking all notifications as read';
        }
        return responseData;
    },

    /**
   * Counts the number of unread notifications for a given user.
   * @param {Object} dbHelper - The database helper for database operations.
   * @param {string} userId - The ID of the user that the notifications belong to.
   * @returns {number} The number of unread notifications.
   */
    countUnread: async (dbHelper, userId) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error counting unread notifications',
        };
        try {
            const count = await dbHelper.count('notification', { userId, isRead: { $ne: true, }, });
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = { count };
        } catch (error) {
            console.error('Error counting unread notifications:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error counting unread notifications';
        }
        return responseData;
    },
};

export default notificationModule;
