import multer from 'multer';

const mem = multer({ storage: multer.memoryStorage() });

export const uploadImage = mem.single('image');
export const uploadLetter = mem.single('letterOfIntentFile');
export const uploadNonavailabilityCert = mem.single('nonavailabilityCertFile');