const notificationModule = {
    /**
   * Creates a new notification for a user and sends it via WebSocket if the user is online.
   * @param {Object} dbHelper - The database helper for database operations.
   * @param {Object} data - The notification data.
   * @param {Object} userSocketMap - The map of user sockets.
   * @returns {Object} The newly created notification.
   */
    createAndNotifyUser: async (dbHelper, data, userSocketMap) => {
        const { title, message, userId, reservationId, } = data;

        const doc = {
            title,
            message,
            isRead: false,
            userId,
            reservationId,
            createdAt: new Date(),
        };

        const saved = await dbHelper.create('notification', doc);

        const userWs = userSocketMap?.get(userId);
        if (userWs && userWs.readyState === 1) {
            userWs.send(JSON.stringify({
                type: 'notification',
                notification: {
                    id: saved.id || saved._id?.toString?.() || saved._id,
                    title,
                    message,
                    createdAt: doc.createdAt,
                    isRead: false,
                    source: "Teachers' Camp",
                    time: 'now',
                },
            }));
        }
        return saved;
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
        const query = { userId, };
        if (before) query.createdAt = { $lt: new Date(before), };

        const rows = await dbHelper.findMany('notification', query, {
            sort: { createdAt: -1, },
            limit: Math.min(Number(limit) || 20, 100),
        });
        return rows;
    },

    /**
   * Marks a notification as read.
   * @param {Object} dbHelper - The database helper for database operations.
   * @param {string} notifId - The ID of the notification to mark as read.
   * @param {string} userId - The ID of the user that the notification belongs to.
   * @returns {Object} The modified notification.
   */
    markRead: async (dbHelper, notifId, userId) => {
        return dbHelper.updateOne('notification', { _id: notifId, userId, }, { $set: { isRead: true, }, });
    },

    /**
   * Marks all notifications for a given user as read.
   * @param {Object} dbHelper - The database helper for database operations.
   * @param {string} userId - The ID of the user that the notifications belong to.
   * @returns {Object} The modified notifications.
   */
    markAllRead: async (dbHelper, userId) => {
        return dbHelper.updateMany('notification', { userId, isRead: { $ne: true, }, }, { $set: { isRead: true, }, });
    },

    /**
   * Counts the number of unread notifications for a given user.
   * @param {Object} dbHelper - The database helper for database operations.
   * @param {string} userId - The ID of the user that the notifications belong to.
   * @returns {number} The number of unread notifications.
   */
    countUnread: async (dbHelper, userId) => {
        return dbHelper.count('notification', { userId, isRead: { $ne: true, }, });
    },
};

export default notificationModule;
