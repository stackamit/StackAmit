import Setting from '../models/Setting.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// ─── Get Public Settings (no auth required) ─────────────────────────────────
export const getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await Setting.find({ isPublic: true });
  const settingsObj = {};
  settings.forEach((s) => { settingsObj[s.key] = s.value; });
  res.status(200).json({ success: true, data: { settings: settingsObj } });
});

// ─── Get All Settings ────────────────────────────────────────────────────────
export const getSettings = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const query = {};
  if (category) query.category = category;

  // Non-admins only see public settings
  if (req.user.role !== 'admin') {
    query.isPublic = true;
  }

  const settings = await Setting.find(query).sort({ category: 1, key: 1 });

  // Convert to key-value object
  const settingsObj = {};
  settings.forEach((s) => {
    settingsObj[s.key] = s.value;
  });

  res.status(200).json({ success: true, data: { settings: settingsObj, raw: settings } });
});

// ─── Get Setting by Key ──────────────────────────────────────────────────────
export const getSettingByKey = asyncHandler(async (req, res) => {
  const setting = await Setting.findOne({ key: req.params.key });
  if (!setting) {
    return res.status(404).json({ success: false, message: 'Setting not found' });
  }
  res.status(200).json({ success: true, data: { setting } });
});

// ─── Update Setting ──────────────────────────────────────────────────────────
export const updateSetting = asyncHandler(async (req, res) => {
  const { key, value, description, isPublic } = req.body;

  const setting = await Setting.findOneAndUpdate(
    { key },
    { value, description, category: req.body.category || 'company', isPublic: isPublic || false },
    { new: true, upsert: true }
  );

  res.status(200).json({ success: true, message: 'Setting updated', data: { setting } });
});

// ─── Bulk Update Settings ────────────────────────────────────────────────────
export const bulkUpdateSettings = asyncHandler(async (req, res) => {
  const { settings } = req.body; // Array of { key, value, category, description, isPublic }

  const operations = settings.map((s) => ({
    updateOne: {
      filter: { key: s.key },
      update: {
        $set: {
          value: s.value,
          category: s.category || 'general',
          description: s.description,
          isPublic: s.isPublic !== undefined ? s.isPublic : (s.category === 'website' || s.category === 'company'),
        },
      },
      upsert: true,
    },
  }));

  await Setting.bulkWrite(operations);

  res.status(200).json({ success: true, message: 'Settings updated' });
});

// ─── Delete Setting ──────────────────────────────────────────────────────────
export const deleteSetting = asyncHandler(async (req, res) => {
  await Setting.findOneAndDelete({ key: req.params.key });
  res.status(200).json({ success: true, message: 'Setting deleted' });
});
