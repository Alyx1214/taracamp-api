import multer from 'multer';

const mem = multer({ storage: multer.memoryStorage() });

export const uploadImages = mem.array('images', 10);
export const uploadLetter = mem.single('letterOfIntentFile');
export const uploadNonavailabilityCert = mem.single('nonavailabilityCertFile');