import { Status, UserRole } from '../constants.js';
import autoResponseEngine from './autoResponseEngine.js';
import { safeRedisOperations } from './redisCircuitBreaker.js';

const MAX_PAGE_SIZE = 50;

// Helper function to invalidate message cache for a user
const invalidateMessageCache = async (userId) => {
    if (!userId) return;
    try {
        const messagesKeys = await safeRedisOperations.keys(`messages:${userId}:*`);
        const countKeys = await safeRedisOperations.keys(`message_count_unread:${userId}`);
        const allKeys = [...messagesKeys, ...countKeys];
        if (allKeys.length > 0) {
            await safeRedisOperations.del(...allKeys);
        }
    } catch (error) {
        console.warn('Error invalidating message cache:', error.message);
    }
};

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

            const limitValue = clampLimit(limit);
            const cacheKey = `messages:${userId}:${limitValue}:${before || 'all'}`;

            // Try cache first
            try {
                const cachedResult = await safeRedisOperations.get(cacheKey);
                if (cachedResult) {
                    const parsed = JSON.parse(cachedResult);
                    responseData.status = Status.OK;
                    responseData.error = null;
                    responseData.data = parsed.data;
                    return responseData;
                }
            } catch (cacheError) {
                console.warn('Cache read error for listForUser:', cacheError);
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
                limit: limitValue,
            });

            const messages = Array.isArray(rows) ? rows.map(toMessagePayload) : [];

            // Cache the result (30 seconds TTL for messages)
            try {
                await safeRedisOperations.set(cacheKey, JSON.stringify({ data: messages }), { EX: 30 });
            } catch (cacheError) {
                console.warn('Cache write error for listForUser:', cacheError);
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = messages;
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

            const cacheKey = `message_count_unread:${userId}`;

            // Try cache first (shorter TTL for count - 10 seconds)
            try {
                const cachedResult = await safeRedisOperations.get(cacheKey);
                if (cachedResult !== null) {
                    const parsed = JSON.parse(cachedResult);
                    responseData.status = Status.OK;
                    responseData.error = null;
                    responseData.data = { count: parsed.count };
                    return responseData;
                }
            } catch (cacheError) {
                console.warn('Cache read error for countUnread:', cacheError);
            }

            const count = await dbHelper.count('message', { userId, isRead: { $ne: true } });

            // Cache the result (10 seconds TTL for unread count)
            try {
                await safeRedisOperations.set(cacheKey, JSON.stringify({ count }), { EX: 10 });
            } catch (cacheError) {
                console.warn('Cache write error for countUnread:', cacheError);
            }

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
            
            // Invalidate cache after marking as read
            if (result) {
                await invalidateMessageCache(userId);
            }

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
            
            // Invalidate cache after marking all as read
            await invalidateMessageCache(userId);

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
            
            // Invalidate cache after sending new message
            await invalidateMessageCache(userId);

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.data = toMessagePayload(saved);

            // Broadcast message via WebSocket if userSocketMap is available
            // Ensure userId is a string (Map keys must match exactly)
            const userIdStr = userId?.toString?.() || String(userId || '');
            if (userSocketMap && userSocketMap.has(userIdStr)) {
                try {
                    const ws = userSocketMap.get(userIdStr);
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

            // If this is a user message (from a guest), also broadcast to all admin connections
            if (isUserMessage && userSocketMap && userSocketMap.size > 0) {
                try {
                    // Get all admin users from database
                    const adminUsers = await dbHelper.findMany('user', {
                        role: { $ne: UserRole.GUEST }
                    }, {
                        limit: 1000 // Reasonable limit for admin users
                    });

                    if (adminUsers && adminUsers.length > 0) {
                        const messagePayload = toMessagePayload(saved);
                        
                        // Broadcast to each admin's WebSocket connection
                        for (const adminUser of adminUsers) {
                            const adminUserIdStr = adminUser._id?.toString?.() || String(adminUser._id || '');
                            if (userSocketMap.has(adminUserIdStr)) {
                                try {
                                    const adminWs = userSocketMap.get(adminUserIdStr);
                                    if (adminWs && adminWs.readyState === 1) { // WebSocket.OPEN
                                        adminWs.send(JSON.stringify({
                                            type: 'new_message',
                                            data: messagePayload
                                        }));
                                    }
                                } catch (error) {
                                    console.error(`Error broadcasting message to admin ${adminUserIdStr}:`, error);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error broadcasting message to admins:', error);
                    // Don't fail the main message send if admin broadcast fails
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
                                
                                // Invalidate cache after auto-response
                                await invalidateMessageCache(userId);
                                
                                // Broadcast automated response via WebSocket
                                // Ensure userId is a string (Map keys must match exactly)
                                const userIdStr = userId?.toString?.() || String(userId || '');
                                if (userSocketMap && userSocketMap.has(userIdStr)) {
                                    try {
                                        const ws = userSocketMap.get(userIdStr);
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

                                // Also broadcast auto-response to all admin connections
                                if (userSocketMap && userSocketMap.size > 0) {
                                    try {
                                        const adminUsers = await dbHelper.findMany('user', {
                                            role: { $ne: UserRole.GUEST }
                                        }, {
                                            limit: 1000
                                        });

                                        if (adminUsers && adminUsers.length > 0) {
                                            const autoResponsePayload = toMessagePayload(autoResponseSaved);
                                            
                                            for (const adminUser of adminUsers) {
                                                const adminUserIdStr = adminUser._id?.toString?.() || String(adminUser._id || '');
                                                if (userSocketMap.has(adminUserIdStr)) {
                                                    try {
                                                        const adminWs = userSocketMap.get(adminUserIdStr);
                                                        if (adminWs && adminWs.readyState === 1) { // WebSocket.OPEN
                                                            adminWs.send(JSON.stringify({
                                                                type: 'new_message',
                                                                data: autoResponsePayload
                                                            }));
                                                        }
                                                    } catch (error) {
                                                        console.error(`Error broadcasting auto-response to admin ${adminUserIdStr}:`, error);
                                                    }
                                                }
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Error broadcasting auto-response to admins:', error);
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

    /**
     * Checks if a user is an admin (non-guest).
     * @param {string} role - The user's role.
     * @returns {boolean} True if the user is an admin.
     */
    isAdmin: (role) => {
        return role && role !== UserRole.GUEST;
    },

    /**
     * Lists all users who have messages (for admin view).
     * @param {Object} dbHelper - The database helper object.
     * @param {Object} user - The admin user object.
     * @returns {Promise<Object>} The response data with list of users.
     */
    listUsersWithMessages: async (dbHelper, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching users with messages',
        };
        try {
            if (!user?.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (!messageModule.isAdmin(user?.role)) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only admins can access this endpoint';
                return responseData;
            }

            // Get distinct user IDs from messages
            const messages = await dbHelper.findMany('message', {}, {
                sort: { createdAt: -1 },
                limit: 10000, // Large limit to get all users
            });

            const userIds = [...new Set(messages.map(m => String(m.userId)).filter(Boolean))];
            
            // Get user details for each userId
            const users = await Promise.all(
                userIds.map(async (userId) => {
                    const userDoc = await dbHelper.findOne('user', { _id: userId });
                    if (!userDoc) return null;
                    
                    // Get unread count for this user
                    const unreadCount = await dbHelper.count('message', { 
                        userId, 
                        isRead: { $ne: true } 
                    });
                    
                    // Get last message
                    const lastMessage = await dbHelper.findOne('message', { userId }, {
                        sort: { createdAt: -1 }
                    });

                    return {
                        _id: userDoc._id?.toString?.() || userDoc._id,
                        name: userDoc.name || 'Unknown',
                        email: userDoc.email || '',
                        role: userDoc.role || '',
                        unreadCount,
                        lastMessage: lastMessage ? toMessagePayload(lastMessage) : null,
                    };
                })
            );

            // Filter out nulls and sort by last message time
            const validUsers = users
                .filter(u => u !== null)
                .sort((a, b) => {
                    if (!a.lastMessage && !b.lastMessage) return 0;
                    if (!a.lastMessage) return 1;
                    if (!b.lastMessage) return -1;
                    return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
                });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = validUsers;
        } catch (error) {
            console.error('Error fetching users with messages:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching users with messages';
        }
        return responseData;
    },

    /**
     * Gets messages for a specific user (admin only).
     * @param {Object} dbHelper - The database helper object.
     * @param {Object} adminUser - The admin user object.
     * @param {string} targetUserId - The ID of the user whose messages to retrieve.
     * @param {Object} options - Query options.
     * @param {number} [options.limit=50] - The maximum number of messages to return.
     * @param {string} [options.before] - The date before which messages should be returned.
     * @returns {Promise<Object>} The response data.
     */
    getMessagesForUser: async (dbHelper, adminUser, targetUserId, { limit, before } = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching messages',
        };
        try {
            if (!adminUser?.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (!messageModule.isAdmin(adminUser?.role)) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only admins can access this endpoint';
                return responseData;
            }

            if (!targetUserId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Target user ID is required';
                return responseData;
            }

            // Use the existing listForUser logic but with targetUserId
            const limitValue = clampLimit(limit);
            const query = { userId: targetUserId };
            if (before) {
                const beforeDate = new Date(before);
                if (!Number.isNaN(beforeDate.getTime())) {
                    query.createdAt = { $lt: beforeDate };
                }
            }

            const rows = await dbHelper.findMany('message', query, {
                sort: { createdAt: -1 },
                limit: limitValue,
            });

            const messages = Array.isArray(rows) ? rows.map(toMessagePayload) : [];

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = messages;
        } catch (error) {
            console.error('Error fetching messages for user:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching messages';
        }
        return responseData;
    },

    /**
     * Sends a message from an admin to a specific user.
     * @param {Object} dbHelper - The database helper object.
     * @param {Object} adminUser - The admin user object.
     * @param {string} targetUserId - The ID of the user to send the message to.
     * @param {Object} data - The message data.
     * @param {Object} userSocketMap - WebSocket map for real-time updates.
     * @returns {Promise<Object>} The response data with the created message.
     */
    sendAdminReply: async (dbHelper, adminUser, targetUserId, data = {}, userSocketMap = null) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error sending message',
        };
        try {
            if (!adminUser?.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (!messageModule.isAdmin(adminUser?.role)) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only admins can send replies';
                return responseData;
            }

            if (!targetUserId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Target user ID is required';
                return responseData;
            }

            const rawText = data.text ?? data.message ?? '';
            const text = String(rawText).trim();
            if (!text) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Message text is required';
                return responseData;
            }

            // Verify target user exists
            const targetUser = await dbHelper.findOne('user', { _id: targetUserId });
            if (!targetUser) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Target user not found';
                return responseData;
            }

            // Create message as admin reply (not from user, not auto-response)
            // This will appear in the same conversation thread as chatbot messages
            const doc = {
                userId: targetUserId, // Message belongs to the target user (same conversation thread)
                text,
                sender: data.sender || adminUser?.name || 'Admin',
                role: adminUser?.role || null,
                isUser: false, // This is an admin reply, appears on left side like chatbot messages
                isRead: false, // User hasn't read it yet
                metadata: {
                    isAdminReply: true,
                    adminUserId: adminUser?.userId,
                    timestamp: new Date()
                }
            };

            const saved = await dbHelper.create('message', doc);
            
            // Invalidate cache after sending new message
            await invalidateMessageCache(targetUserId);

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.data = toMessagePayload(saved);

            // Broadcast message via WebSocket to the target user
            // Use the MongoDB ObjectId string format from the database lookup (most reliable)
            // This ensures we match the format used when the user connected via WebSocket
            const targetUserMongoId = targetUser?._id?.toString?.() || targetUser?._id;
            const targetUserIdStr = targetUserMongoId ? String(targetUserMongoId) : (targetUserId?.toString?.() || String(targetUserId || ''));
            
            // Try to find the WebSocket connection
            let ws = null;
            if (userSocketMap) {
                // First try direct lookup with the MongoDB ObjectId string format
                if (userSocketMap.has(targetUserIdStr)) {
                    ws = userSocketMap.get(targetUserIdStr);
                }
                // If not found, try iterating through the map to find a case-insensitive match
                // This handles any edge cases where the format might differ slightly
                else {
                    for (const [mapUserId, mapWs] of userSocketMap.entries()) {
                        const mapUserIdStr = String(mapUserId);
                        // Try exact match first
                        if (mapUserIdStr === targetUserIdStr) {
                            ws = mapWs;
                            break;
                        }
                        // Try case-insensitive match
                        if (mapUserIdStr.toLowerCase() === targetUserIdStr.toLowerCase()) {
                            ws = mapWs;
                            break;
                        }
                    }
                }
            }
            
            // Send WebSocket message if connection found
            if (ws) {
                try {
                    if (ws.readyState === 1) { // WebSocket.OPEN
                        ws.send(JSON.stringify({
                            type: 'new_message',
                            data: toMessagePayload(saved)
                        }));
                        console.log(`Admin reply broadcasted to user ${targetUserIdStr} via WebSocket`);
                    } else {
                        console.log(`WebSocket for user ${targetUserIdStr} is not open (readyState: ${ws?.readyState})`);
                    }
                } catch (error) {
                    console.error('Error broadcasting admin reply via WebSocket:', error);
                }
            } else {
                // Log available user IDs in map for debugging
                const availableUserIds = userSocketMap ? Array.from(userSocketMap.keys()).slice(0, 5) : [];
                const mapSize = userSocketMap ? userSocketMap.size : 0;
                console.log(`User ${targetUserIdStr} not found in WebSocket map (map size: ${mapSize}). Looking for: "${targetUserIdStr}". Available users (sample): ${availableUserIds.join(', ')}`);
            }
        } catch (error) {
            console.error('Error sending admin reply:', error);
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
        userId: raw.userId?.toString?.() ?? raw.userId,
        sender: raw.sender || 'System',
        role: raw.role || undefined,
        text: raw.text || '',
        isUser: Boolean(raw.isUser),
        isRead: Boolean(raw.isRead),
        timeLabel: makeTimeLabel(createdAt),
        createdAt,
    };
}
