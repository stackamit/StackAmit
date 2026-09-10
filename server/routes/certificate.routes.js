import express from 'express';
import {
  generateCertificate, getCertificates, verifyCertificate,
  revokeCertificate, getCertificateStats, getCertificateById,
  downloadCertificatePDF, getCertificateQR,
} from '../controllers/certificate.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public verification
router.get('/verify', verifyCertificate);

// Protected routes
router.use(protect);
router.get('/stats', authorize('admin'), getCertificateStats);
router.post('/generate', authorize('admin', 'trainer'), generateCertificate);
router.get('/', getCertificates);
router.get('/:id', getCertificateById);
router.get('/:id/download', downloadCertificatePDF);
router.get('/:id/qr', getCertificateQR);
router.patch('/:id/revoke', authorize('admin'), revokeCertificate);

export default router;
