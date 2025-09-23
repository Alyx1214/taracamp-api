import { Status } from '../constants.js';

const MAX_PAGE_SIZE = 50;

const messageModule = {
    /**
     * Retrieves messages for a given user.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} userId - The ID of the user.
     * @param {Object} options - Query options.
     * @param {number} [options.limit=50] - The maximum number of messages to return.
     * @param {string} [options.before] - The date before which messages should be returned.
     * @returns {Promise<Object>} The response data.
     */
    listForUser: async (dbHelper, userId, { limit, before } = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching messages',
        };
        try {
            if (!userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            const query = { userId };
            if (before) {
                const beforeDate = new Date(before);
                if (!Number.isNaN(beforeDate.getTime())) {
                    query.createdAt = { $lt: beforeDate };
                }
            }

            const rows = await dbHelper.findMany('message', query, {
                sort: { createdAt: -1 },
                limit: clampLimit(limit),
            });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = Array.isArray(rows) ? rows.map(toMessagePayload) : [];
        } catch (error) {
            console.error('Error fetching messages:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching messages';
        }
        return responseData;
    },

    /**
     * Counts the number of unread messages for a given user.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} userId - The ID of the user that the messages belong to.
     * @returns {Promise<Object>} The response data with the count of unread messages.
     */
    countUnread: async (dbHelper, userId) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error counting unread messages',
        };
        try {
            if (!userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            const count = await dbHelper.count('message', { userId, isRead: { $ne: true } });
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = { count };
        } catch (error) {
            console.error('Error counting unread messages:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error counting unread messages';
        }
        return responseData;
    },

    /**
     * Marks a message as read.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} messageId - The ID of the message to mark as read.
     * @param {string} userId - The ID of the user that the message belongs to.
     * @returns {Promise<Object>} The response data with the updated message.
     */
    markRead: async (dbHelper, messageId, userId) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error updating message',
        };
        try {
            if (!userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }
            if (!messageId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing message ID';
                return responseData;
            }

            const result = await dbHelper.updateOne('message', { _id: messageId, userId }, { $set: { isRead: true } });
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = result ? toMessagePayload(result) : null;
        } catch (error) {
            console.error('Error marking message as read:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error updating message';
        }
        return responseData;
    },

    /**
     * Marks all unread messages for a given user as read.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} userId - The ID of the user that the messages belong to.
     * @returns {Promise<Object>} The response data with the updated messages.
     */
    markAllRead: async (dbHelper, userId) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error updating messages',
        };
        try {
            if (!userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            const result = await dbHelper.updateMany('message', { userId, isRead: { $ne: true } }, { $set: { isRead: true } });
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = result;
        } catch (error) {
            console.error('Error marking all messages as read:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error updating messages';
        }
        return responseData;
    },

    /**
     * Sends a message to a user.
     * @param {Object} dbHelper - The database helper object.
     * @param {Object} user - The user object containing the user ID and role.
     * @param {Object} data - The data object containing the message text and sender name.
     * @returns {Promise<Object>} The response data with the status, error, and the created message.
     */
    sendMessage: async (dbHelper, user, data = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error sending message',
        };
        try {
            const userId = user?.userId;
            if (!userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            const rawText = data.text ?? data.message ?? '';
            const text = String(rawText).trim();
            if (!text) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Message text is required';
                return responseData;
            }

            const isUserMessage = data.isUser ?? true;
            const doc = {
                userId,
                text,
                sender: data.sender || user?.name || 'You',
                role: data.role || null,
                isUser: isUserMessage,
                isRead: data.isRead ?? isUserMessage,
            };

            const saved = await dbHelper.create('message', doc);
            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.data = toMessagePayload(saved);
        } catch (error) {
            console.error('Error sending message:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error sending message';
        }
        return responseData;
    },
};

export default messageModule;

function clampLimit(limit) {
    const n = Number(limit);
    if (!Number.isFinite(n) || n <= 0) return 20;
    return Math.min(Math.floor(n), MAX_PAGE_SIZE);
}

function makeTimeLabel(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const now = Date.now();
    const diffMs = now - date.getTime();
    if (diffMs < 0) return 'now';
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diffMs < minute) return 'now';
    if (diffMs < hour) return Math.max(1, Math.floor(diffMs / minute)) + 'm';
    if (diffMs < day) return Math.floor(diffMs / hour) + 'h';
    const days = Math.floor(diffMs / day);
    if (days < 7) return days + 'd';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toMessagePayload(doc) {
    const raw = doc?.toObject?.() ?? doc ?? {};
    const createdAt = raw.createdAt ? new Date(raw.createdAt) : new Date();
    return {
        _id: raw._id?.toString?.() ?? raw._id,
        sender: raw.sender || 'System',
        role: raw.role || undefined,
        text: raw.text || '',
        isUser: Boolean(raw.isUser),
        isRead: Boolean(raw.isRead),
        timeLabel: makeTimeLabel(createdAt),
        createdAt,
    };
}
