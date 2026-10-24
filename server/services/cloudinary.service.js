import { v2 as cloudinary } from 'cloudinary';
import stream from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// SA-015: the `folder` reaches Cloudinary straight from `req.body.folder`, so an
// untrusted value like `../../<other-tenant>` could escape this app's namespace.
// Restrict uploads to a fixed set of logical folders and validate the resource
// type. These helpers are pure so they can be unit-verified without a DB/CDN.
export const ALLOWED_UPLOAD_FOLDERS = [
  'avatars', 'resumes', 'certificates', 'general', 'documents',
  'articles', 'internships', 'media', 'assignments',
];

export const ALLOWED_RESOURCE_TYPES = ['image', 'raw', 'video', 'auto'];

// Return a canonical allow-listed folder, or `fallback` when the requested
// folder is missing/not allow-listed. Comparison is case-insensitive and
// trimmed; any traversal/separators are rejected by never matching the list.
export const sanitizeUploadFolder = (folder, fallback = 'general') => {
  if (typeof folder !== 'string') return fallback;
  const norm = folder.trim().toLowerCase();
  return ALLOWED_UPLOAD_FOLDERS.includes(norm) ? norm : fallback;
};

// Clamp an arbitrary resource_type to the allow-list (defaults to 'auto').
export const sanitizeResourceType = (resourceType, fallback = 'auto') => {
  if (typeof resourceType !== 'string') return fallback;
  const norm = resourceType.trim().toLowerCase();
  return ALLOWED_RESOURCE_TYPES.includes(norm) ? norm : fallback;
};

/**
 * Upload a file buffer to Cloudinary
 */
export const uploadToCloudinary = async (fileBuffer, folder, resourceType = 'auto') => {
  const safeFolder = sanitizeUploadFolder(folder, 'general');
  const safeType = sanitizeResourceType(resourceType, 'auto');
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `stackamit/${safeFolder}`,
        resource_type: safeType,
        allowed_formats: safeFolder === 'resumes'
          ? ['pdf']
          : safeFolder === 'certificates'
          ? ['pdf']
          : ['jpg', 'png', 'gif', 'webp', 'pdf', 'zip'],
        transformation: safeType === 'image'
          ? [{ width: 500, height: 500, crop: 'limit', quality: 'auto' }]
          : [],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          public_id: result.public_id,
          url: result.secure_url,
          format: result.format,
          size: result.bytes,
        });
      }
    );

    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);
    bufferStream.pipe(uploadStream);
  });
};

/**
 * Delete a file from Cloudinary
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return null;
  }
};

/**
 * Get Cloudinary URL for verification
 */
export const getCloudinaryUrl = (publicId) => {
  return cloudinary.url(publicId, { secure: true });
};

export default cloudinary;
