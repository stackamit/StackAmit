import multer from 'multer';
import path from 'path';

// Memory storage for Cloudinary upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    document: ['application/pdf', 'application/zip', 'application/x-zip-compressed'],
    any: ['*'],
  };

  const type = req.fileType || 'image';
  const types = allowedTypes[type] || allowedTypes.image;

  if (types.includes('*') || types.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${types.join(', ')}`), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export const uploadResume = upload.single('resume');
export const uploadImage = upload.single('image');
export const uploadFiles = upload.array('files', 10);
