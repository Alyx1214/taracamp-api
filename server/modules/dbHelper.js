import mongoose from 'mongoose';
import sanitizeHtml from 'sanitize-html';
import { UserRole, Category, GuestType, ReservationStatus, FacilityType, FacilityStatus, ServiceType, FileKind } from '../constants.js';

function sanitizeObject(obj) {
    if (typeof obj === 'string') {
        return sanitizeHtml(obj.trim(), { 
            allowedTags: [], 
            allowedAttributes: {},
            disallowedTagsMode: 'discard'
        });
    }
    // Preserve Mongo ObjectId instances as-is
    if (obj instanceof mongoose.Types.ObjectId) {
        return obj;
    }
    if (obj instanceof Date) {
        return obj;
    }
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (typeof obj === 'object' && obj !== null) {
        const sanitized = {};
        for (const key of Object.keys(obj)) {
            if (['password', 'verificationCode', 'letterOfIntentFile', 'approvalDocumentFile', 'resetTokenHash', 'verificationCodeHash'].includes(key)) {
                sanitized[key] = obj[key];
                continue;
            }
            sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
    }
    return obj;
}

const dbHelper = {
    connect: async (connectionString) => {
        try {
            const UserSchema = new mongoose.Schema({
                email: { type: String, required: false, unique: true, index: true, },
                name: { type: String, required: true, index: true, },
                password: { type: String, required: false, },
                googleId: { type: String, required: false, unique: true, sparse: true, },
                facebookId: { type: String, required: false, unique: true, sparse: true, },
                role: { type: String, enum: Object.values(UserRole), required: true, default: UserRole.GUEST, index: true, },
                createdAt: { type: Date, default: Date.now, index: true, },
                updatedAt: { type: Date, required: false, },
                lastLoggedIn: { type: Date, required: false, index: true, },
                verificationCodeHash: { type: String, required: false, },
                verificationCodeExpiry: { type: Date, required: false, },
                resetTokenHash: { type: String, required: false, },
                resetTokenExpiry: { type: Date, required: false, },
            });

            UserSchema.index({ email: 1, role: 1 });
            UserSchema.index({ name: 1, role: 1 });
            UserSchema.index({ createdAt: -1, role: 1 });
            UserSchema.index({ lastLoggedIn: -1, role: 1 });
            UserSchema.index({ email: 'text', name: 'text', role: 'text' });

            const ProfileSchema = new mongoose.Schema({
                about: { type: String, required: false, },
                address: { type: String, required: false, },
                xProfile: { type: String, required: false, },
                fbProfile: { type: String, required: false, },
                instagramProfile: { type: String, required: false, },
                linkedInProfile: { type: String, required: false, },
                profilePic: { type: String, required: true, },
                createdProfileAt: { type: Date, default: Date.now, },
                updatedProfileAt: { type: Date, required: false, },
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, },
            });

            const FileSchema = new mongoose.Schema({
                path: { type: String, required: true },
                mimetype: { type: String, required: false },
                size: { type: Number, required: false },
                kind: { type: String, enum: Object.values(FileKind), required: false }, 
                reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'reservation', required: false },
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: false },
                createdAt: { type: Date, default: Date.now },
                updatedAt: { type: Date, required: false },
            });

            const ReservationSchema = new mongoose.Schema({
                guestName: { type: String, required: true, },
                homeAddress: { type: String, required: true, },
                officeAddress: { type: String, required: false, },
                category: { type: String, enum: Object.values(Category), required: true, },
                guestType: { type: String, enum: Object.values(GuestType), required: true, },
                telephone: { type: String, required: true, },
                officeTelephone: { type: String, required: false, },
                guestEmail: { type: String, required: false, index: true },
                numberOfGuests: {
                    total: { type: Number, required: true, },
                    adult: { type: Number, required: true, },
                    children: { type: Number, required: false, },
                    pwds: { type: Number, required: false, },
                    seniorCitizen: { type: Number, required: false, },
                },
                numberOfRooms: { type: Number, required: false, },
                emergencyContact: { type: String, required: true, },
                emergencyContactPerson: { type: String, required: false, },
                dateOfArrival: { type: Date, required: true, index: true },
                dateOfDeparture: { type: Date, required: true, },
                timeOfArrival: { type: String, required: true, },
                facility: { type: mongoose.Schema.Types.ObjectId, ref: 'facility', required: true, },
                serviceType: { type: String, enum: Object.values(ServiceType), required: true, },
                letterOfIntentFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'file', required: false },
                seniorCitizenIdFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'file', required: false },
                nonAvailabilityCertFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'file', required: false },
                nonAvailabilityCertFileUploadedAt: { type: Date, required: false, },
                status: { type: String, enum: Object.values(ReservationStatus), default: ReservationStatus.PENDING, required: true, index: true },
                totalEstimatedAmount: { type: Number, required: true, },
                otherRequests: { type: String, required: false, },
                addOns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'addon' }],
                createdAt: { type: Date, default: Date.now, index: true },
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: false, index: true },
                reservationCode: { type: String, required: true, unique: true, index: true },
                checkedOutBy: { type: String, required: false },
                checkedOutAt: { type: Date, required: false },
            });

            ReservationSchema.index({ status: 1, dateOfArrival: 1 });
            ReservationSchema.index({ dateOfArrival: 1, status: 1 });
            // Compound index to prevent overlapping reservations for the same facility
            ReservationSchema.index({ 
                facility: 1, 
                dateOfArrival: 1, 
                dateOfDeparture: 1 
            }, { 
                unique: true, 
                partialFilterExpression: { 
                    status: { $in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] } 
                } 
            });

            const FacilitySchema = new mongoose.Schema({
                name: { type: String, required: true, unique: true, },
                facilityType: { type: String, enum: Object.values(FacilityType), required: true, },
                capacity: { type: Number, required: false, },
                ratePerPerson: { type: Number, required: false, },
                price: { type: Number, required: false, },
                status: { type: String, enum: Object.values(FacilityStatus), default: FacilityStatus.AVAILABLE, required: true, },
                images: { type: [String], default: [] },
                createdAt: { type: Date, default: Date.now, },
            });

            const AddOnSchema = new mongoose.Schema({
                name: { type: String, required: true, },
                price: { type: Number, required: true, },
                unit: { type: String, required: false, },
                createdAt: { type: Date, default: Date.now, },
            });

            const NotificationSchema = new mongoose.Schema({
                title: { type: String, required: true, },
                message: { type: String, required: false, },
                kind: { type: String, required: false, },
                isRead: { type: Boolean, default: false, },
                createdAt: { type: Date, default: Date.now, },
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, },
                reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'reservation', required: false, },
            });

            const MessageSchema = new mongoose.Schema({
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true, },
                sender: { type: String, required: true, },
                role: { type: String, required: false, },
                text: { type: String, required: true, maxlength: 2000, },
                isUser: { type: Boolean, default: false, },
                isRead: { type: Boolean, default: false, },
                createdAt: { type: Date, default: Date.now, index: true, },
                updatedAt: { type: Date, required: false, },
            });

            const PaymentSchema = new mongoose.Schema({
                piId: { type: String, required: false, index: true, },
                paymentId: { type: String, required: false, index: true, },
                reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'reservation', required: false, index: true, },
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: false, index: true, },
                amountCentavos: { type: Number, required: false, },
                currency: { type: String, required: false, },
                description: { type: String, required: false, },
                status: { type: String, required: false, },
                paymentMethodType: { type: String, required: false, },
                referenceNumber: { type: String, required: false, },
                createdAt: { type: Date, default: Date.now, },
                updatedAt: { type: Date, required: false, },
                paidAt: { type: Date, required: false, },
            });

            const ReviewSchema = new mongoose.Schema({
                facilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'facility', required: true, index: true, },
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true, },
                reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'reservation', required: false, },
                rating: {
                    location: { type: Number, min: 1, max: 10, required: true, },
                    service: { type: Number, min: 1, max: 10, required: true, },
                    cleanliness: { type: Number, min: 1, max: 10, required: true, },
                    overall: { type: Number, min: 1, max: 10, required: true, },
                },
                text: { type: String, required: true, maxlength: 1000, },
                authorName: { type: String, required: false, },
                isVerified: { type: Boolean, default: false, },
                createdAt: { type: Date, default: Date.now, },
                updatedAt: { type: Date, required: false, },
            });

            mongoose.model('user', UserSchema);
            mongoose.model('profile', ProfileSchema);
            mongoose.model('reservation', ReservationSchema);
            mongoose.model('file', FileSchema);
            mongoose.model('facility', FacilitySchema);
            mongoose.model('addon', AddOnSchema);
            mongoose.model('notification', NotificationSchema);
            mongoose.model('message', MessageSchema);
            mongoose.model('payment', PaymentSchema);
            mongoose.model('review', ReviewSchema);

            await mongoose.connect(connectionString);
        } catch (error) {
            console.error('Error connecting to MongoDB:', error);
        }
    },

    create: async (collectionName, document) => {
        const sanitizedDoc = sanitizeObject({ ...document, });
        return await mongoose.model(collectionName).create(sanitizedDoc);
    },

    find: async (collectionName, query = {}, projection = {}) => {
        return await mongoose.model(collectionName).find(query, projection);
    },

    findOne: async (collectionName, query, options = {}) => {
        const { projection = null } = options;
        return await mongoose.model(collectionName).findOne(query, projection);
    },

    findMany: async (collectionName, query = {}, options = {}) => {
        const { projection = null, sort = null, limit = null, skip = null, } = options;
        return await mongoose
            .model(collectionName)
            .find(query, projection, { sort, limit, skip, });
    },

    updateOne: async (collectionName, query, update) => {
        if (update && update.$set) {
            update.$set = sanitizeObject({ ...update.$set, });
        } else if (update) {
            update = sanitizeObject({ ...update, });
        }
        return await mongoose.model(collectionName).findOneAndUpdate(query, update, { new: true, runValidators: true, });
    },

    findOneAndUpdate: async (collectionName, query, update) => {
        if (update && update.$set) {
            update.$set = sanitizeObject({ ...update.$set, });
        } else if (update) {
            update = sanitizeObject({ ...update, });
        }
        return await mongoose.model(collectionName).findOneAndUpdate(query, update, { new: true, runValidators: true, });
    },

    count: async (collectionName, query = {}) => {
        return await mongoose.model(collectionName).countDocuments(query);
    },

    aggregate: async (collectionName, pipeline = []) => {
        return await mongoose.model(collectionName).aggregate(pipeline);
    },

    updateMany: async (collectionName, query, update) => {
        if (update && update.$set) {
            update.$set = sanitizeObject({ ...update.$set, });
        } else if (update) {
            update = sanitizeObject({ ...update, });
        }
        return await mongoose.model(collectionName).updateMany(query, update, { runValidators: true, });
    },

    deleteOne: async (collectionName, query) => {
        return await mongoose.model(collectionName).deleteOne(query);
    },

    deleteMany: async (collectionName, query) => {
        return await mongoose.model(collectionName).deleteMany(query);
    },

    withTransaction: async (callback) => {
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                await callback(session);
            });
        } finally {
            await session.endSession();
        }
    },

    createWithTransaction: async (collectionName, document, session) => {
        const sanitizedDoc = sanitizeObject({ ...document, });
        const created = await mongoose.model(collectionName).create([sanitizedDoc], { session });
        return Array.isArray(created) ? created[0] : created;
    },

    findOneWithTransaction: async (collectionName, query, options = {}, session) => {
        const { projection = null } = options;
        return await mongoose.model(collectionName).findOne(query, projection).session(session);
    },

    updateOneWithTransaction: async (collectionName, query, update, session) => {
        if (update && update.$set) {
            update.$set = sanitizeObject({ ...update.$set, });
        } else if (update) {
            update = sanitizeObject({ ...update, });
        }
        return await mongoose.model(collectionName).findOneAndUpdate(query, update, { 
            new: true, 
            runValidators: true,
            session 
        });
    },

    findManyWithTransaction: async (collectionName, query = {}, projection = {}, session) => {
        return await mongoose.model(collectionName).find(query, projection).session(session);
    },
};

export default dbHelper;
