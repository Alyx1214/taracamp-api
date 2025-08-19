import { Status, UserRole, } from '../constants.js';
import dbHelper from './dbHelper.js';

const specialServiceModule = {
    /**
     * Adds a new special service to the database.
     * @param {Object} dbHelper - The database helper for DB operations
     * @param {Object} data - Data object containing name, price, and unit
     * @param {Object} user - The user object representing the current user
     * @returns {Object} Response data with status, error, message, and specialServiceId on success.
     */
    addSpecialService: async (dbHelper, data, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error adding special service',
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

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only CRMS team and Superintendent can add a special service';
                return responseData;
            }

            const existing = await dbHelper.findOne('specialservice', {
                name,
                price,
                unit,
            });

            if (existing) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Special service already exists';
                return responseData;
            }

            const specialServiceData = {
                name,
                price,
                unit,
            };

            const specialService = await dbHelper.create('specialservice', specialServiceData);

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.message = 'Special service added successfully';
            responseData.specialServiceId = specialService._id.toString();

        } catch (error) {
            console.error('Error adding special service:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Fetches all special services.
     * @param {Object} dbHelper - The database helper for database operations.
     * @returns {Object} Response data with status, error, and specialServices on success.
     */
    getAllSpecialServices: async (dbHelper) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching special services',
            specialServices: [],
        };

        try {
            const specialServices = await dbHelper.find('specialservice', {}, { __v: 0, createdAt: 0, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.specialServices = specialServices;
        } catch (error) {
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Fetches a special service by its ID.
     * @param {string} id - The ID of the special service.
     * @returns {Object} Response data with status, error, and specialService on success.
     */
    getSpecialServiceById: async (id) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching special service',
            specialService: null,
        };

        if (!id) {
            responseData.status = Status.BAD_REQUEST;
            responseData.error = 'Missing special service ID';
            return responseData;
        }

        try {
            const specialService = await dbHelper.findOne('specialservice', { _id: id, });
            if (!specialService) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Special service not found';
                return responseData;
            }

            const specialServiceObject = specialService.toObject();
            delete specialServiceObject.__v;
            delete specialServiceObject.createdAt;

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.specialService = specialServiceObject;
        } catch (error) {
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Edits a special service by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} id - The ID of the special service to be edited.
     * @param {Object} data - The data object containing the new values for name, price, and unit
     * @param {Object} file - The file object containing the new image.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, message, and specialServiceId on success.
     */
    updateSpecialService: async (dbHelper, id, data, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error editing special service',
        };

        try {
            if (!id) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing special service ID';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only CRMS team  and Superintendent can edit a special service';
                return responseData;
            }

            const specialService = await dbHelper.findOne('specialservice', { _id: id, });
            if (!specialService) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Special service not found';
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
            if (isPresent(data.unit)) updateData.unit = data.unit;

            const existing = await dbHelper.findOne('specialservice', {
                _id: { $ne: id, },
                name: updateData.name || specialService.name,
                price: updateData.price || specialService.price,
                unit: updateData.unit || specialService.unit,
            });

            if (existing) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Another special service with the same details already exists';
                return responseData;
            }

            await dbHelper.updateOne('specialservice', { _id: id, }, { $set: updateData, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Special service updated successfully';
            responseData.specialServiceId = id;
        } catch (error) {
            console.error('Error editing special service:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Deletes a special service by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} id - The ID of the special service to be deleted.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, message, and specialServiceId on success.
     */
    deleteSpecialService: async (dbHelper, id, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error deleting special service',
        };

        try {
            if (!id) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing special service ID';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only CRMS team and Superintendent can delete a special service';
                return responseData;
            }

            const specialService = await dbHelper.findOne('specialservice', { _id: id, });
            if (!specialService) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Special service not found';
                return responseData;
            }

            await dbHelper.deleteOne('specialservice', { _id: id, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Special service deleted successfully';
            responseData.specialServiceId = id;
        } catch (error) {
            console.error('Error deleting special service:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Searches special services with optional filters.
     * @param {Object} dbHelper - Database helper.
     * @param {Object} options - { query, minPrice, maxPrice, unit }
     * @returns {Object} Response data with status, error, and specialServices on success.
     */
    searchSpecialServices: async (dbHelper, options = {}) => {
        const { query, minPrice, maxPrice, unit, } = options;
        const responseData = {
            status: 500,
            error: 'Error searching special services',
            specialServices: [],
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

            const specialServices = await dbHelper.find('specialservice', filter, { __v: 0, createdAt: 0, });

            responseData.status = 200;
            responseData.error = null;
            responseData.specialServices = specialServices;
        } catch (error) {
            responseData.error = error.message;
        }
        return responseData;
    },
};

export default specialServiceModule;

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

