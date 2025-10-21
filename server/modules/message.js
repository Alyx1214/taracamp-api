import { Status } from '../constants.js';
import autoResponseEngine from './autoResponseEngine.js';

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
     * Sends a message to a user with optional automated response.
     * @param {Object} dbHelper - The database helper object.
     * @param {Object} user - The user object containing the user ID and role.
     * @param {Object} data - The data object containing the message text and sender name.
     * @param {Object} options - Additional options for message processing.
     * @param {boolean} [options.enableAutoResponse=true] - Whether to enable automated responses.
     * @returns {Promise<Object>} The response data with the status, error, and the created message.
     */
    sendMessage: async (dbHelper, user, data = {}, options = {}, userSocketMap = null) => {
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

            // Broadcast message via WebSocket if userSocketMap is available
            if (userSocketMap && userSocketMap.has(userId)) {
                try {
                    const ws = userSocketMap.get(userId);
                    if (ws && ws.readyState === 1) { // WebSocket.OPEN
                        ws.send(JSON.stringify({
                            type: 'new_message',
                            data: toMessagePayload(saved)
                        }));
                    }
                } catch (error) {
                    console.error('Error broadcasting message via WebSocket:', error);
                }
            }

            // Process automated response if this is a user message and auto-response is enabled
            const enableAutoResponse = options.enableAutoResponse !== false;
            if (isUserMessage && enableAutoResponse) {
                try {
                    const autoResponseResult = await autoResponseEngine.processMessage(
                        dbHelper, 
                        userId, 
                        text, 
                        { userRole: user?.role, userName: user?.name }
                    );

                    if (autoResponseResult.shouldSendAutoResponse && autoResponseResult.autoResponse) {
                        // Add a small delay before sending automated response
                        setTimeout(async () => {
                            try {
                                const autoResponseDoc = {
                                    userId: autoResponseResult.autoResponse.userId,
                                    text: autoResponseResult.autoResponse.text,
                                    sender: autoResponseResult.autoResponse.sender,
                                    role: autoResponseResult.autoResponse.role,
                                    isUser: autoResponseResult.autoResponse.isUser,
                                    isRead: autoResponseResult.autoResponse.isRead,
                                    metadata: autoResponseResult.autoResponse.metadata
                                };

                                const autoResponseSaved = await dbHelper.create('message', autoResponseDoc);
                                
                                // Broadcast automated response via WebSocket
                                if (userSocketMap && userSocketMap.has(userId)) {
                                    try {
                                        const ws = userSocketMap.get(userId);
                                        if (ws && ws.readyState === 1) { // WebSocket.OPEN
                                            ws.send(JSON.stringify({
                                                type: 'new_message',
                                                data: toMessagePayload(autoResponseSaved)
                                            }));
                                        }
                                    } catch (error) {
                                        console.error('Error broadcasting auto-response via WebSocket:', error);
                                    }
                                }
                            } catch (error) {
                                console.error('Error sending automated response:', error);
                            }
                        }, 1000); // 1 second delay
                    }

                    // Include analysis in response for debugging/admin purposes
                    responseData.autoResponseAnalysis = autoResponseResult.analysis;
                } catch (error) {
                    console.error('Error processing automated response:', error);
                    // Don't fail the main message send if auto-response fails
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error sending message';
        }
        return responseData;
    },

    /**
     * Gets automated response configuration and statistics.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} userId - The ID of the user (admin only).
     * @returns {Promise<Object>} The response data with configuration and stats.
     */
    getAutoResponseConfig: async (dbHelper, userId) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching auto-response configuration',
        };
        try {
            if (!userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            // Get configuration
            const config = autoResponseEngine.getConfig();
            
            // Get knowledge base
            const knowledgeBase = autoResponseEngine.getKnowledgeBase();
            
            // Get statistics (count of auto responses sent)
            const autoResponseCount = await dbHelper.count('message', { 
                'metadata.isAutoResponse': true 
            });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = {
                config,
                knowledgeBase,
                statistics: {
                    totalAutoResponses: autoResponseCount
                }
            };
        } catch (error) {
            console.error('Error fetching auto-response configuration:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching auto-response configuration';
        }
        return responseData;
    },

    /**
     * Updates automated response configuration.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} userId - The ID of the user (admin only).
     * @param {Object} config - New configuration options.
     * @returns {Promise<Object>} The response data.
     */
    updateAutoResponseConfig: async (dbHelper, userId, config) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error updating auto-response configuration',
        };
        try {
            if (!userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            autoResponseEngine.updateConfig(config);
            
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = { message: 'Configuration updated successfully' };
        } catch (error) {
            console.error('Error updating auto-response configuration:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error updating auto-response configuration';
        }
        return responseData;
    },

    /**
     * Tests a message against the automated response engine.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} userId - The ID of the user (admin only).
     * @param {string} testMessage - Message to test.
     * @returns {Promise<Object>} The response data with test results.
     */
    testAutoResponse: async (dbHelper, userId, testMessage) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error testing auto-response',
        };
        try {
            if (!userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (!testMessage || typeof testMessage !== 'string') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Test message is required';
                return responseData;
            }

            const testResult = autoResponseEngine.testMessage(testMessage);
            
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = {
                testMessage,
                analysis: testResult,
                suggestedResponse: testResult.response
            };
        } catch (error) {
            console.error('Error testing auto-response:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error testing auto-response';
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
