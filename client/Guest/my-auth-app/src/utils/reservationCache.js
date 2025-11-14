/**
 * Reservation data cache utility
 * Caches reservation data in localStorage with TTL to avoid repeated API calls
 */

const CACHE_PREFIX = 'reservation_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get cached reservation data
 * @param {string} reservationId - The reservation ID
 * @returns {object|null} Cached reservation data or null if not found/expired
 */
export function getCachedReservation(reservationId) {
  if (!reservationId) return null;

  try {
    const cacheKey = `${CACHE_PREFIX}${reservationId}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired
    if (now - timestamp > CACHE_TTL) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return data;
  } catch (error) {
    console.warn('Error reading reservation cache:', error);
    return null;
  }
}

/**
 * Set cached reservation data
 * @param {string} reservationId - The reservation ID
 * @param {object} data - The reservation data to cache
 */
export function setCachedReservation(reservationId, data) {
  if (!reservationId || !data) return;

  try {
    const cacheKey = `${CACHE_PREFIX}${reservationId}`;
    const cacheData = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Error writing reservation cache:', error);
    // If storage is full, try to clear old entries
    try {
      clearExpiredCache();
      localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (e) {
      console.warn('Failed to clear expired cache:', e);
    }
  }
}

/**
 * Clear cached reservation data
 * @param {string} reservationId - The reservation ID (optional, clears all if not provided)
 */
export function clearCachedReservation(reservationId) {
  try {
    if (reservationId) {
      const cacheKey = `${CACHE_PREFIX}${reservationId}`;
      localStorage.removeItem(cacheKey);
    } else {
      // Clear all reservation caches
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.warn('Error clearing reservation cache:', error);
  }
}

/**
 * Clear expired cache entries
 */
function clearExpiredCache() {
  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const { timestamp } = JSON.parse(cached);
            if (now - timestamp > CACHE_TTL) {
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
          // If parsing fails, remove the corrupted entry
          localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.warn('Error clearing expired cache:', error);
  }
}

// Clean up expired cache on module load
if (typeof window !== 'undefined') {
  clearExpiredCache();
}

