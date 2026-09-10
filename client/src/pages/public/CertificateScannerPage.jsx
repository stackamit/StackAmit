import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiCamera, FiCameraOff, FiCheckCircle, FiXCircle,
  FiAlertTriangle, FiArrowLeft, FiShield, FiHash,
  FiUser, FiBriefcase, FiClock, FiAward,
} from 'react-icons/fi';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const typeLabels = {
  completion: { label: 'Completion', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  participation: { label: 'Participation', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  merit: { label: 'Merit', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
};

const CertificateScannerPage = () => {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [manualInput, setManualInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanning = async () => {
    setError('');
    setCameraError('');
    setResult(null);

    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQRDecoded(decodedText);
        },
        () => {} // ignore scan errors
      );

      setScanning(true);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Unable to access camera. Please grant camera permissions or use manual input below.');
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      await html5QrCodeRef.current.stop().catch(() => {});
    }
    setScanning(false);
  };

  const handleQRDecoded = async (text) => {
    // Stop scanning first
    await stopScanning();

    // Try to extract certificate number from URL
    let certNumber = text;
    try {
      const url = new URL(text);
      certNumber = url.searchParams.get('certificateNumber') || text;
    } catch {
      // Not a URL, use as-is
    }

    // Clean up the certificate number
    certNumber = certNumber.trim();
    if (certNumber) {
      verifyCertificate(certNumber);
    }
  };

  const handleManualVerify = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    verifyCertificate(manualInput.trim());
  };

  const verifyCertificate = async (certNumber) => {
    setVerifying(true);
    setError('');
    setResult(null);

    try {
      const { data } = await axios.get(`${API_URL}/api/certificates/verify`, {
        params: { certificateNumber: certNumber },
      });
      setResult(data.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No certificate found with this number. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-[80vh] bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiCamera size={32} className="text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-dark-900 dark:text-white">
            Scan Certificate QR
          </h1>
          <p className="mt-3 text-dark-500 dark:text-dark-400 text-lg">
            Point your camera at the QR code on the certificate to verify it
          </p>
        </motion.div>

        {/* Scanner */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6 mb-8">
          <div id="qr-reader" className="rounded-xl overflow-hidden mb-4" style={{ display: scanning ? 'block' : 'none' }} />

          {cameraError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-start gap-3 mb-4">
              <FiAlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 dark:text-red-400 text-sm">{cameraError}</p>
            </div>
          )}

          {!scanning ? (
            <div className="text-center">
              <div className="w-48 h-48 mx-auto mb-6 bg-dark-50 dark:bg-dark-800/50 rounded-2xl flex items-center justify-center border-2 border-dashed border-dark-200 dark:border-dark-700">
                <FiCamera size={48} className="text-dark-300 dark:text-dark-600" />
              </div>
              <button onClick={startScanning} className="btn-primary px-8 py-3 flex items-center gap-2 mx-auto text-base">
                <FiCamera size={20} /> Start Scanning
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-dark-500 dark:text-dark-400 mb-3">Point your camera at a certificate QR code</p>
              <button onClick={stopScanning} className="btn-outline px-6 py-2 flex items-center gap-2 mx-auto text-sm">
                <FiCameraOff size={16} /> Stop Scanner
              </button>
            </div>
          )}

          {/* Manual input */}
          <div className="mt-6 pt-6 border-t border-dark-200 dark:border-dark-700">
            <p className="text-sm text-dark-500 dark:text-dark-400 text-center mb-3">Or enter the certificate number manually</p>
            <form onSubmit={handleManualVerify} className="flex gap-3">
              <div className="relative flex-1">
                <FiHash className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="input-field pl-11 py-3"
                  placeholder="e.g. MTC-2026-00001"
                />
              </div>
              <button
                type="submit"
                disabled={verifying || !manualInput.trim()}
                className="btn-primary px-6 py-3 flex items-center gap-2 disabled:opacity-50"
              >
                {verifying ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiShield size={18} />
                )}
                <span className="hidden sm:inline">{verifying ? 'Verifying...' : 'Verify'}</span>
              </button>
            </form>
          </div>
        </motion.div>

        {/* Loading */}
        {verifying && (
          <div className="card p-8 text-center">
            <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-dark-500 dark:text-dark-400">Verifying certificate...</p>
          </div>
        )}

        {/* Error */}
        {error && !verifying && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-8 text-center">
            <FiXCircle size={48} className="mx-auto text-red-400 mb-4" />
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">Not Found</h3>
            <p className="text-dark-500 dark:text-dark-400 mb-4">{error}</p>
            <button onClick={() => { setError(''); setResult(null); setManualInput(''); }} className="btn-outline text-sm">
              Try Again
            </button>
          </motion.div>
        )}

        {/* Revoked result */}
        {result?.isRevoked && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6 border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3 mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <FiAlertTriangle size={28} className="text-red-500 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-red-700 dark:text-red-400 text-lg">Certificate Revoked</h3>
                <p className="text-red-600 dark:text-red-400/80 text-sm">This certificate has been revoked and is no longer valid.</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiHash size={16} className="text-dark-400" />
                <div>
                  <p className="text-xs text-dark-400">Certificate Number</p>
                  <p className="font-mono font-semibold text-dark-900 dark:text-white text-sm">{result.certificate.certificateNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiUser size={16} className="text-dark-400" />
                <div>
                  <p className="text-xs text-dark-400">Student Name</p>
                  <p className="font-semibold text-dark-900 dark:text-white text-sm">{result.certificate.studentName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiBriefcase size={16} className="text-dark-400" />
                <div>
                  <p className="text-xs text-dark-400">Internship</p>
                  <p className="font-semibold text-dark-900 dark:text-white text-sm">{result.certificate.internshipTitle}</p>
                </div>
              </div>
              {result.certificate.revokeReason && (
                <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                  <FiAlertTriangle size={16} className="text-red-400" />
                  <div>
                    <p className="text-xs text-red-400">Reason</p>
                    <p className="font-semibold text-red-700 dark:text-red-400 text-sm">{result.certificate.revokeReason}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Valid result */}
        {result?.isValid && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6 border-2 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3 mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <FiCheckCircle size={28} className="text-green-500 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-green-700 dark:text-green-400 text-lg">Certificate Verified</h3>
                <p className="text-green-600 dark:text-green-400/80 text-sm">This certificate is authentic and currently valid.</p>
              </div>
            </div>

            {/* Mini certificate card */}
            <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-5 text-white mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <img src="/stackamit-logo.jpg" alt="StackAmit" className="w-7 h-7 object-contain rounded-lg bg-white/20" />
                  <span className="font-display font-bold text-sm">StackAmit</span>
                </div>
                <FiAward size={20} className="text-white/60" />
              </div>
              <div className="text-center py-2">
                <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Certificate of {typeLabels[result.certificate.type]?.label || result.certificate.type}</p>
                <p className="text-xl font-bold">{result.certificate.studentName}</p>
                <p className="text-white/80 text-sm mt-1">{result.certificate.internshipTitle}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-white/60 mt-2">
                <span>{formatDate(result.certificate.issuedDate)}</span>
                <span className="font-mono">{result.certificate.certificateNumber}</span>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiHash size={16} className="text-primary-500" />
                <div>
                  <p className="text-xs text-dark-400">Certificate Number</p>
                  <p className="font-mono font-semibold text-dark-900 dark:text-white text-sm">{result.certificate.certificateNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiAward size={16} className="text-primary-500" />
                <div>
                  <p className="text-xs text-dark-400">Type</p>
                  <span className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${typeLabels[result.certificate.type]?.color || ''}`}>
                    {typeLabels[result.certificate.type]?.label || result.certificate.type}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiUser size={16} className="text-primary-500" />
                <div>
                  <p className="text-xs text-dark-400">Student</p>
                  <p className="font-semibold text-dark-900 dark:text-white text-sm">{result.certificate.studentName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiBriefcase size={16} className="text-primary-500" />
                <div>
                  <p className="text-xs text-dark-400">Program</p>
                  <p className="font-semibold text-dark-900 dark:text-white text-sm">{result.certificate.internshipTitle}</p>
                </div>
              </div>
              {result.certificate.duration && (
                <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                  <FiClock size={16} className="text-primary-500" />
                  <div>
                    <p className="text-xs text-dark-400">Duration</p>
                    <p className="font-semibold text-dark-900 dark:text-white text-sm">{result.certificate.duration}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiCheckCircle size={16} className="text-primary-500" />
                <div>
                  <p className="text-xs text-dark-400">Issue Date</p>
                  <p className="font-semibold text-dark-900 dark:text-white text-sm">{formatDate(result.certificate.issuedDate)}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mt-6">
              <button onClick={() => { setResult(null); setManualInput(''); setError(''); }} className="btn-outline text-sm flex items-center gap-2">
                <FiArrowLeft size={16} /> Scan Another
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CertificateScannerPage;
