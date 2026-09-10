import express from 'express';
import { uploadImage, uploadDocument, uploadMultiple } from '../controllers/upload.controller.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();
router.use(protect);

router.post('/image', upload.single('file'), uploadImage);
router.post('/document', upload.single('file'), uploadDocument);
router.post('/multiple', upload.array('files', 10), uploadMultiple);

export default router;
