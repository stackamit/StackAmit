import { v2 as cloudinary } from 'cloudinary';
import stream from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a file buffer to Cloudinary
 */
export const uploadToCloudinary = async (fileBuffer, folder, resourceType = 'auto') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `stackamit/${folder}`,
        resource_type: resourceType,
        allowed_formats: folder === 'resumes'
          ? ['pdf']
          : folder === 'certificates'
          ? ['pdf']
          : ['jpg', 'png', 'gif', 'webp', 'pdf', 'zip'],
        transformation: resourceType === 'image'
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
