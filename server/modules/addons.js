import { Status, UserRole, UnitType, } from '../constants.js';
import dbHelper from './dbHelper.js';
import { safeRedisOperations } from './redisCircuitBreaker.js';

const addonsModule = {
    /**
     * Adds a new add-on to the database.
     * @param {Object} dbHelper - The database helper for DB operations
     * @param {Object} data - Data object containing name, price, and unit
     * @param {Object} user - The user object representing the current user
     * @returns {Object} Response data with status, error, message, and addonId on success.
     */
    addAddon: async (dbHelper, data, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error adding add-on',
        };

        try {
            const { name, price, unit, } = data;

            if (!isPresent(name) || !isPresent(price) || !isPresent(unit)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing required fields (name, price, unit)';
                return responseData;
            }

            if (!isValidPrice(price)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid price value';
                return responseData;
            }

            if (!isValidUnit(unit)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid unit type.';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only CRMS team and Superintendent can add an add-on';
                return responseData;
            }

            const existing = await dbHelper.findOne('addon', {
                name,
                price,
                unit,
            });

            if (existing) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Add-on already exists';
                return responseData;
            }

            const addonData = {
                name,
                price,
                unit,
            };

            const addon = await dbHelper.create('addon', addonData);

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.message = 'Add-on added successfully';
            responseData.addonId = addon._id.toString();

            // Invalidate cache after successful creation
            await invalidateAddonsCache();

        } catch (error) {
            console.error('Error adding add-on:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error adding add-on';
        }
        return responseData;
    },

    /**
     * Fetches all add-ons.
     * @param {Object} dbHelper - The database helper for database operations.
     * @returns {Object} Response data with status, error, and addons on success.
     */
    getAllAddons: async (dbHelper, options = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching add-ons',
            addons: [],
        };

        try {
            const { limit, skip, sort, } = options || {};
            const sortOption = sort ? parseSort(sort) : { name: 1, };
            const limitValue = clampLimit(limit);
            const skipValue = clampSkip(skip);
            
            // Generate cache key
            const cacheKey = `addons:all:${JSON.stringify({
                sort: sortOption,
                limit: limitValue,
                skip: skipValue
            })}`;
            
            // Try to get from cache first
            try {
                const cached = await safeRedisOperations.get(cacheKey);
                if (cached) {
                    const cachedData = JSON.parse(cached);
                    responseData.status = Status.OK;
                    responseData.error = null;
                    responseData.addons = cachedData.addons;
                    return responseData;
                }
            } catch (cacheError) {
                console.warn('Cache read error:', cacheError.message);
            }
            
            const addons = await dbHelper.findMany('addon', {}, {
                projection: { __v: 0, createdAt: 0, },
                sort: sortOption,
                limit: limitValue,
                skip: skipValue,
            });

            // Cache the result
            try {
                await safeRedisOperations.set(cacheKey, JSON.stringify({ addons }), { EX: 300 }); // 5 minutes TTL
            } catch (cacheError) {
                console.warn('Cache write error:', cacheError.message);
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.addons = addons;
        } catch (error) {
            console.error('Error fetching add-ons:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching add-ons';
        }
        return responseData;
    },

    /**
     * Fetches an add-on by its ID.
     * @param {string} id - The ID of the add-on.
     * @returns {Object} Response data with status, error, and addon on success.
     */
    getAddonById: async (dbHelper, id) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching add-on',
            addon: null,
        };

        if (!id) {
            responseData.status = Status.BAD_REQUEST;
            responseData.error = 'Missing add-on ID';
            return responseData;
        }

        try {
            // Generate cache key
            const cacheKey = `addon:${id}`;
            
            // Try to get from cache first
            try {
                const cached = await safeRedisOperations.get(cacheKey);
                if (cached) {
                    const cachedData = JSON.parse(cached);
                    responseData.status = Status.OK;
                    responseData.error = null;
                    responseData.addon = cachedData.addon;
                    return responseData;
                }
            } catch (cacheError) {
                console.warn('Cache read error:', cacheError.message);
            }
            
            const addon = await dbHelper.findOne('addon', { _id: id, });
            if (!addon) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Add-on not found';
                return responseData;
            }

            const addonObject = addon.toObject();
            delete addonObject.__v;
            delete addonObject.createdAt;

            // Cache the result
            try {
                await safeRedisOperations.set(cacheKey, JSON.stringify({ addon: addonObject }), { EX: 300 }); // 5 minutes TTL
            } catch (cacheError) {
                console.warn('Cache write error:', cacheError.message);
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.addon = addonObject;
        } catch (error) {
            console.error('Error fetching add-on:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching add-on';
        }
        return responseData;
    },

    /**
     * Edits an add-on by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} id - The ID of the add-on to be edited.
     * @param {Object} data - The data object containing the new values for name, price, and unit
     * @param {Object} file - The file object containing the new image.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, message, and addonId on success.
     */
    updateAddon: async (dbHelper, id, data, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error editing add-on',
        };

        try {
            if (!id) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing add-on ID';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only CRMS team and Superintendent can edit an add-on';
                return responseData;
            }

            const addon = await dbHelper.findOne('addon', { _id: id, });
            if (!addon) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Add-on not found';
                return responseData;
            }

            const updateData = {};
            if (isPresent(data.name)) updateData.name = data.name;
            if (isPresent(data.price)) {
                if (!isValidPrice(data.price)) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid price value';
                    return responseData;
                }
                updateData.price = Number(String(data.price).replace(/,/g, '')) || 0;
            }
            if (isPresent(data.unit)) {
                if (!isValidUnit(data.unit)) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid unit type.';
                    return responseData;
                }
                updateData.unit = data.unit;
            }

            const existing = await dbHelper.findOne('addon', {
                _id: { $ne: id, },
                name: updateData.name || addon.name,
                price: updateData.price || addon.price,
                unit: updateData.unit || addon.unit,
            });

            if (existing) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Another add-on with the same details already exists';
                return responseData;
            }

            await dbHelper.updateOne('addon', { _id: id, }, { $set: updateData, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Add-on updated successfully';
            responseData.addonId = id;

            // Invalidate cache after successful update
            await invalidateAddonsCache();
        } catch (error) {
            console.error('Error editing add-on:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error editing add-on';
        }
        return responseData;
    },

    /**
     * Updates multiple add-ons in a single operation.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Array} updates - Array of update objects with id, name, price, unit
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and message on success.
     */
    updateManyAddons: async (dbHelper, updates, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error updating add-ons',
        };

        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only CRMS team and Superintendent can edit add-ons';
                return responseData;
            }

            if (!Array.isArray(updates) || updates.length === 0) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'No updates provided';
                return responseData;
            }

            for (const update of updates) {
                const { id, name, price, unit, } = update;
                
                if (!id) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Missing add-on ID';
                    return responseData;
                }

                const addon = await dbHelper.findOne('addon', { _id: id, });
                if (!addon) {
                    responseData.status = Status.NOT_FOUND;
                    responseData.error = 'Add-on not found';
                    return responseData;
                }

                const updateData = {};
                if (isPresent(name)) updateData.name = name;
                if (isPresent(price)) {
                    if (!isValidPrice(price)) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Invalid price value';
                        return responseData;
                    }
                    updateData.price = Number(String(price).replace(/,/g, '')) || 0;
                }
                if (isPresent(unit)) {
                    if (!isValidUnit(unit)) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Invalid unit type.';
                        return responseData;
                    }
                    updateData.unit = unit;
                }

                const existing = await dbHelper.findOne('addon', {
                    _id: { $ne: id, },
                    name: updateData.name || addon.name,
                    price: updateData.price || addon.price,
                    unit: updateData.unit || addon.unit,
                });

                if (existing) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Another add-on with the same details already exists';
                    return responseData;
                }

                await dbHelper.updateOne('addon', { _id: id, }, { $set: updateData, });
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Add-ons updated successfully';

            // Invalidate cache after successful updates
            await invalidateAddonsCache();

        } catch (error) {
            console.error('Error updating add-ons:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error updating add-ons';
        }
        return responseData;
    },

    /**
     * Deletes an add-on by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} id - The ID of the add-on to be deleted.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, message, and addonId on success.
     */
    deleteAddon: async (dbHelper, id, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error deleting add-on',
        };

        try {
            if (!id) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing add-on ID';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only CRMS team and Superintendent can delete an add-on';
                return responseData;
            }

            const addon = await dbHelper.findOne('addon', { _id: id, });
            if (!addon) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Add-on not found';
                return responseData;
            }

            await dbHelper.deleteOne('addon', { _id: id, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Add-on deleted successfully';
            responseData.addonId = id;

            // Invalidate cache after successful deletion
            await invalidateAddonsCache();
        } catch (error) {
            console.error('Error deleting add-on:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error deleting add-on';
        }
        return responseData;
    },

    /**
     * Searches add-ons with optional filters.
     * @param {Object} dbHelper - Database helper.
     * @param {Object} options - { query, minPrice, maxPrice, unit }
     * @returns {Object} Response data with status, error, and addons on success.
     */
    searchAddons: async (dbHelper, options = {}) => {
        const { query, minPrice, maxPrice, unit, } = options;
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error searching add-ons',
            addons: [],
        };

        try {
            let filter = {};
            if (query) filter.name = new RegExp(query.trim(), 'i');
            if (unit) filter.unit = new RegExp(unit.trim(), 'i');

            if (minPrice || maxPrice) {
                filter.price = {};
                if (minPrice) filter.price.$gte = Number(minPrice);
                if (maxPrice) filter.price.$lte = Number(maxPrice);
            }

            // Generate cache key
            const cacheKey = `search-addons:${JSON.stringify({
                query,
                unit,
                minPrice,
                maxPrice
            })}`;
            
            // Try to get from cache first
            try {
                const cached = await safeRedisOperations.get(cacheKey);
                if (cached) {
                    const cachedData = JSON.parse(cached);
                    responseData.status = Status.OK;
                    responseData.error = null;
                    responseData.addons = cachedData.addons;
                    return responseData;
                }
            } catch (cacheError) {
                console.warn('Cache read error:', cacheError.message);
            }

            const addons = await dbHelper.find('addon', filter, { __v: 0, createdAt: 0, });

            // Cache the result
            try {
                await safeRedisOperations.set(cacheKey, JSON.stringify({ addons }), { EX: 300 }); // 5 minutes TTL
            } catch (cacheError) {
                console.warn('Cache write error:', cacheError.message);
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.addons = addons;
        } catch (error) {
            console.error('Error searching add-ons:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error searching add-ons';
        }
        return responseData;
    },
};

export default addonsModule;

function isPresent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'number') {
    return !Number.isNaN(value);
  }
  return true;
}

function isValidPrice(price) {
    const normalized = String(price).replace(/,/g, '');
    if (isNaN(Number(normalized)) || Number(normalized) < 0) {
        return false;
    }
    if (normalized.includes('.')) {
        const decimalPart = normalized.split('.')[1];
        if (decimalPart.length > 2) {
            return false;
        }
    }
    return true;
}

function clampLimit(value, def = undefined) {
    if (value === null || value === undefined || value === '') return def;
    const n = Number(value);
    if (!Number.isFinite(n)) return def;
    return Math.max(1, Math.min(100, Math.trunc(n)));
}

function clampSkip(value, def = 0) {
    if (value === null || value === undefined || value === '') return def;
    const n = Number(value);
    if (!Number.isFinite(n)) return def;
    return Math.max(0, Math.trunc(n));
}

function parseSort(spec) {
    if (!spec) return null;
    const parts = String(spec).split(',');
    const result = {};
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const isDesc = trimmed.startsWith('-');
        const field = isDesc ? trimmed.slice(1) : trimmed;
        if (!field) continue;
        result[field] = isDesc ? -1 : 1;
    }
    return Object.keys(result).length > 0 ? result : null;
}

function isValidUnit(unit) {
    if (!isPresent(unit)) return false;
    const validUnits = Object.values(UnitType);
    return validUnits.includes(unit);
}

/**
 * Invalidates addon-related cache entries
 */
async function invalidateAddonsCache() {
    try {
        const patterns = [
            'addons:*',
            'addon:*',
            'search-addons:*'
        ];
        
        for (const pattern of patterns) {
            const keys = await safeRedisOperations.keys(pattern);
            if (keys && keys.length > 0) {
                await safeRedisOperations.del(...keys);
            }
        }
    } catch (error) {
        console.warn('Error invalidating addons cache:', error.message);
    }
}