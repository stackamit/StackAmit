import { uploadToCloudinary } from '../services/cloudinary.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import Media from '../models/Media.js';

// ─── Upload Image ────────────────────────────────────────────────────────────
export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const folder = req.body.folder || 'general';
  const result = await uploadToCloudinary(req.file.buffer, folder, 'image');

  // Best-effort: index the asset in the Media Library so it can be reused later
  // (deduped by public_id). Failures here must never break the upload response.
  try {
    if (result?.public_id && result?.url) {
      await Media.findOneAndUpdate(
        { public_id: result.public_id },
        {
          $set: {
            url: result.url,
            folder,
            resource_type: 'image',
            format: result.format,
            size: result.size,
            uploadedBy: req.user?._id || req.user?.id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  } catch (e) {
    console.error('Media index upsert failed:', e?.message);
  }

  res.status(200).json({
    success: true,
    message: 'File uploaded successfully',
    data: result,
  });
});

// ─── Upload Document ─────────────────────────────────────────────────────────
export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const folder = req.body.folder || 'documents';
  const result = await uploadToCloudinary(req.file.buffer, folder, 'raw');

  res.status(200).json({
    success: true,
    message: 'Document uploaded successfully',
    data: result,
  });
});

// ─── Upload Multiple Files ───────────────────────────────────────────────────
export const uploadMultiple = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded' });
  }

  const folder = req.body.folder || 'general';
  const results = await Promise.all(
    req.files.map((file) => uploadToCloudinary(file.buffer, folder, 'auto'))
  );

  res.status(200).json({
    success: true,
    message: `${results.length} file(s) uploaded successfully`,
    data: results,
  });
});

// ─── List Media Library (current user's reusable uploads) ─────────────────────
export const listMedia = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 80, 200);
  const resourceType = req.query.resource_type || 'image';
  const userId = req.user?._id || req.user?.id;

  const items = await Media.find({ uploadedBy: userId, resource_type: resourceType })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('url public_id folder format size createdAt');

  res.status(200).json({
    success: true,
    message: 'Media fetched successfully',
    data: { items, total: items.length },
  });
});
