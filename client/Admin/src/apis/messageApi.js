import { apiGet, apiPost } from './api';

/**
 * Admin message API functions
 */

/**
 * Lists all users who have messages (admin only)
 * @returns {Promise<Object>} List of users with their message info
 */
export function listUsersWithMessages() {
  return apiGet('/message/admin/users');
}

/**
 * Gets messages for a specific user (admin only)
 * @param {string} userId - The ID of the user whose messages to retrieve
 * @param {Object} options - Query options
 * @param {number} [options.limit] - Maximum number of messages to return
 * @param {string} [options.before] - Date before which messages should be returned
 * @returns {Promise<Object>} Messages for the user
 */
export function getMessagesForUser(userId, options = {}) {
  if (!userId) throw new Error('userId is required');
  return apiGet(`/message/admin/user/${encodeURIComponent(userId)}/messages`, options);
}

/**
 * Sends a reply from an admin to a specific user
 * @param {string} userId - The ID of the user to send the message to
 * @param {Object} data - Message data
 * @param {string} data.text - The message text
 * @param {string} [data.sender] - Optional sender name (defaults to admin name)
 * @returns {Promise<Object>} The created message
 */
export function sendAdminReply(userId, data) {
  if (!userId) throw new Error('userId is required');
  if (!data?.text) throw new Error('Message text is required');
  return apiPost(`/message/admin/reply/${encodeURIComponent(userId)}`, data);
}

