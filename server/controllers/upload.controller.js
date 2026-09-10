import { uploadToCloudinary } from '../services/cloudinary.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// ─── Upload Image ────────────────────────────────────────────────────────────
export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const folder = req.body.folder || 'general';
  const result = await uploadToCloudinary(req.file.buffer, folder, 'image');

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
