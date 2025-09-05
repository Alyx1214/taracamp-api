import { Status, ProfilePic } from '../constants.js';
// import sharp from 'sharp';

const profileModule = {
    createProfile: async (dbHelper, userId) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on creating profile'
        };
        try {
            await dbHelper.create('profile', {
                about: '',
                address: '',
                xProfile: '',
                fbProfile: '',
                instagramProfile: '',
                linkedInProfile: '',
                profilePic: ProfilePic,
                createdProfileAt: new Date().valueOf(),
                updatedProfileAt: null,
                userId
            });
            responseData.status = Status.OK;
            responseData.error = null;
        } catch (error) {
            console.error('Error creating profile:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on creating profile';
        }
        return responseData;
    },
    getProfile: async (dbHelper, session) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on getting user profile'
        };
        try {
            if (!session.userEmail) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'Unauthorized';
                return responseData;
            }

            const profile = await dbHelper.findOne('profile', { userId: session.userId });
            if (!profile) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Profile not found';
                return responseData;
            }

            const profileObject = profile.toObject();

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = profileObject;

        } catch (error) {
            console.error('Error on getting user profile:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on getting user profile';
        }
        return responseData;
    },
    updateProfile: async (dbHelper, session, data) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on updating user profile'
        };
        try {
            if (!session.userEmail) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'Unauthorized';
                return responseData;
            }
            const profile = await dbHelper.findOne('profile', { userId: session.userId });
            if (!profile) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Profile not found';
                return responseData;
            }
            const { about, address, xProfile, fbProfile, instagramProfile, linkedInProfile } = data;
            if (!isPresent(about) && !isPresent(address) && !isPresent(xProfile) && !isPresent(fbProfile) && !isPresent(instagramProfile) && !isPresent(linkedInProfile)) { // Check if any of the fields are empty
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'No fields to update';
                return responseData;
            }
            await dbHelper.updateOne('profile', { userId: session.userId }, { about, address, xProfile, fbProfile, instagramProfile, linkedInProfile, updatedProfileAt: new Date().valueOf() });
            responseData.status = Status.OK;
            responseData.error = null;
        } catch (error) {
            console.error('Error on updating user profile:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on updating user profile';
        }
        return responseData;
    },
    updateProfilePic: async (dbHelper, session, data) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on updating user profile picture'
        };
        try {
            if (!session.userEmail) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'Unauthorized';
                return responseData;
            }
            const profile = await dbHelper.findOne('profile', { userId: session.userId });
            if (!profile) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Profile not found';
                return responseData;
            }
            const { profilePic } = data;
            if (!isPresent(profilePic) || !isBase64Image(profilePic)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Profile picture is required';
                return responseData;
            }

            // const base64Data = profilePic.replace(/^data:image\/\w+;base64,/, '');
            // const croppedImageBuffer = await resizeImage(Buffer.from(base64Data, 'base64'), 60, 60);
            // const croppedImageBase64 = toBase64Image(croppedImageBuffer);
            await dbHelper.updateOne('profile', { userId: session.userId }, { profilePic: profilePic, updatedProfileAt: new Date().valueOf() });

            responseData.status = Status.OK;
            responseData.error = null;
        } catch (error) {
            console.error('Error on updating user profile picture:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on updating user profile picture';
        }
        return responseData;
    }
};

export default profileModule;

function isPresent(value) {
    return value !== null && value !== undefined && value.trim().length > 0;
}

function isBase64Image(value) {
    return /^data:image\/(png|jpg|jpeg|gif|webp);base64/.test(value);
}

// async function resizeImage(imageBuffer, width, height) {
//     return await sharp(imageBuffer)
//         .resize({
//             width: width,
//             height: height,
//             fit: sharp.fit.inside,
//             withoutEnlargement: true
//         })
//         .toBuffer();
// }

function toBase64Image(imageBuffer) {
    return `data:image/png;base64,${imageBuffer.toString('base64')}`;
}