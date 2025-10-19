// Auto Response API client for Admin interface
import { apiRequest } from '../apis/api.js';

export const autoResponseApi = {
  /**
   * Get automated response configuration and statistics
   * @returns {Promise<Object>} Configuration and statistics data
   */
  getConfig: async () => {
    return apiRequest('GET', '/message/auto-response/config');
  },

  /**
   * Update automated response configuration
   * @param {Object} config - New configuration options
   * @returns {Promise<Object>} Update result
   */
  updateConfig: async (config) => {
    return apiRequest('POST', '/message/auto-response/config', config);
  },

  /**
   * Test a message against the automated response engine
   * @param {string} message - Message to test
   * @returns {Promise<Object>} Test results
   */
  testMessage: async (message) => {
    return apiRequest('POST', '/message/auto-response/test', { message });
  },

  /**
   * Enable or disable automated responses
   * @param {boolean} enabled - Whether to enable automated responses
   * @returns {Promise<Object>} Update result
   */
  toggleEnabled: async (enabled) => {
    return apiRequest('POST', '/message/auto-response/config', { enabled });
  },

  /**
   * Update confidence threshold
   * @param {number} threshold - New confidence threshold (0.1 - 1.0)
   * @returns {Promise<Object>} Update result
   */
  updateConfidenceThreshold: async (threshold) => {
    return apiRequest('POST', '/message/auto-response/config', { confidenceThreshold: threshold });
  },

  /**
   * Update response delay
   * @param {number} delay - New response delay in milliseconds
   * @returns {Promise<Object>} Update result
   */
  updateResponseDelay: async (delay) => {
    return apiRequest('POST', '/message/auto-response/config', { responseDelay: delay });
  }
};
