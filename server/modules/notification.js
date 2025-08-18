const notificationModule = {
    /**
     * Creates a new notification for a user and sends it to the user over a WebSocket connection, if available.
     * @param {Object} dbHelper - The database helper object for database operations.
     * @param {Object} data - The notification data.
     * @param {Map<string, WebSocket>} userSocketMap - A map of user IDs to WebSocket connections.
     * @return {Promise<Object>} A promise that resolves to the saved notification object.
     */
    createAndNotifyUser: async (dbHelper, data, userSocketMap) => {
        const { title, message, userId, reservationId, } = data;
        const notification = {
            title,
            message,
            isRead: false,
            userId,
            reservationId,
            createdAt: new Date(),
        };

        const saved = await dbHelper.create('notification', notification);

        const userWs = userSocketMap?.get(userId);
        if (userWs && userWs.readyState === 1) {
            userWs.send(JSON.stringify({
                type: 'notification',
                notification: {
                    title,
                    message,
                    createdAt: notification.createdAt,
                },
            }));
        }

        return saved;
    },
};

export default notificationModule;
