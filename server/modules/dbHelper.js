import mongoose from 'mongoose';
import sanitizeHtml from 'sanitize-html';
import { UserRole, Category, GuestType, ReservationStatus, FacilityType, FacilityStatus, ServiceType, FileKind } from '../constants.js';

function sanitizeObject(obj) {
    if (typeof obj === 'string') {
        return sanitizeHtml(obj, { allowedTags: [], allowedAttributes: {}, });
    }
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (typeof obj === 'object' && obj !== null) {
        for (const key of Object.keys(obj)) {
            if (['password', 'verificationCode', 'letterOfIntentFile', 'approvalDocumentFile'].includes(key)) continue;
            obj[key] = sanitizeObject(obj[key]);
        }
        return obj;
    }
    return obj;
}

const dbHelper = {
    connect: async (connectionString) => {
        try {
            const UserSchema = new mongoose.Schema({
                email: { type: String, required: false, unique: true, },
                name: { type: String, required: true, },
                password: { type: String, required: false, },
                googleId: { type: String, required: false, unique: true, sparse: true, },
                facebookId: { type: String, required: false, unique: true, sparse: true, },
                role: { type: String, enum: Object.values(UserRole), required: true, default: UserRole.GUEST, },
                createdAt: { type: Date, default: Date.now, },
                updatedAt: { type: Date, required: false, },
                lastLoggedIn: { type: Date, required: false, },
                verificationCodeHash: { type: String, required: false, },
                verificationCodeExpiry: { type: Date, required: false, },
                resetTokenHash: { type: String, required: false, },
                resetTokenExpiry: { type: Date, required: false, },
            });

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
                numberOfGuests: {
                    total: { type: Number, required: true, },
                    adult: { type: Number, required: true, },
                    children: { type: Number, required: false, },
                    pwds: { type: Number, required: false, },
                },
                emergencyContact: { type: String, required: true, },
                dateOfArrival: { type: Date, required: true, },
                dateOfDeparture: { type: Date, required: true, },
                timeOfArrival: { type: String, required: true, },
                facility: { type: mongoose.Schema.Types.ObjectId, ref: 'facility', required: true, },
                serviceType: { type: String, enum: Object.values(ServiceType), required: true, },
                letterOfIntentFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'file', required: false },
                approvalDocumentFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'file', required: false },
                approvalDocumentUploadedAt: { type: Date, required: false, },
                status: { type: String, enum: Object.values(ReservationStatus), default: ReservationStatus.PENDING, required: true, },
                totalEstimatedAmount: { type: Number, required: true, },
                otherRequests: { type: String, required: false, },
                createdAt: { type: Date, default: Date.now, },
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, },
            });

            const FacilitySchema = new mongoose.Schema({
                name: { type: String, required: true, unique: true, },
                facilityType: { type: String, enum: Object.values(FacilityType), required: true, },
                capacity: { type: Number, required: false, },
                ratePerPerson: { type: Number, required: false, },
                price: { type: Number, required: false, },
                status: { type: String, enum: Object.values(FacilityStatus), default: FacilityStatus.AVAILABLE, required: true, },
                image: { type: String, required: false, },
                createdAt: { type: Date, default: Date.now, },
            });

            const SpecialServiceSchema = new mongoose.Schema({
                name: { type: String, required: true, },
                price: { type: Number, required: true, },
                unit: { type: String, required: false, },
                createdAt: { type: Date, default: Date.now, },
            });

            const NotificationSchema = new mongoose.Schema({
                title: { type: String, required: true, },
                message: { type: String, required: true, },
                isRead: { type: Boolean, default: false, },
                createdAt: { type: Date, default: Date.now, },
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, },
                reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'reservation', required: false, },
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

            mongoose.model('user', UserSchema);
            mongoose.model('profile', ProfileSchema);
            mongoose.model('reservation', ReservationSchema);
            mongoose.model('file', FileSchema);
            mongoose.model('facility', FacilitySchema);
            mongoose.model('specialservice', SpecialServiceSchema);
            mongoose.model('notification', NotificationSchema);
            mongoose.model('payment', PaymentSchema);

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

    findOne: async (collectionName, query) => {
        return await mongoose.model(collectionName).findOne(query);
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

    findMany: async (collectionName, query = {}, options = {}) => {
        const { projection = null, sort = null, limit = null, skip = null, } = options;
        return await mongoose
            .model(collectionName)
            .find(query, projection, { sort, limit, skip, });
    },

    count: async (collectionName, query = {}) => {
        return await mongoose.model(collectionName).countDocuments(query);
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
};

export default dbHelper;
