import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiAward, FiDownload, FiShare2, FiCheckCircle, FiXCircle,
  FiExternalLink, FiHash, FiUser, FiBriefcase, FiClock,
  FiCalendar, FiCopy, FiCheck, FiSquare, FiAlertTriangle,
} from 'react-icons/fi';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const typeConfig = {
  completion: { label: 'Completion', gradient: 'from-blue-600 to-indigo-700', accent: '#4f46e5' },
  participation: { label: 'Participation', gradient: 'from-emerald-600 to-teal-700', accent: '#059669' },
  merit: { label: 'Merit', gradient: 'from-amber-500 to-orange-600', accent: '#d97706' },
};

const CertificateViewPage = () => {
  const { id } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const certRef = useRef(null);

  useEffect(() => { fetchCertificate(); }, [id]);

  const fetchCertificate = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/certificates/${id}`);
      setCertificate(data.data);
    } catch (err) {
      setError(err.response?.status === 404 ? 'Certificate not found' : 'Failed to load certificate');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await axios.get(`${API_URL}/api/certificates/${id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Certificate-${certificate?.certificate?.certificateNumber || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Social sharing
  const cert = certificate?.certificate;
  const verificationUrl = certificate?.verificationUrl || '';
  const shareText = cert
    ? `I've earned a ${typeConfig[cert.type]?.label || cert.type} Certificate from StackAmit for completing "${cert.internshipTitle}"! Verify: ${verificationUrl}`
    : '';

  const shareLinks = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verificationUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(verificationUrl)}&quote=${encodeURIComponent(shareText)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-dark-500 dark:text-dark-400">Loading certificate...</p>
        </div>
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="card p-12 text-center max-w-md">
          <FiXCircle size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-2">Certificate Not Found</h2>
          <p className="text-dark-500 dark:text-dark-400 mb-6">{error || 'This certificate does not exist.'}</p>
          <Link to="/verify-certificate" className="btn-primary inline-flex items-center gap-2">
            <FiAward size={18} /> Verify a Certificate
          </Link>
        </div>
      </div>
    );
  }

  const config = typeConfig[cert.type] || typeConfig.completion;
  const studentName = cert.studentName || 'Student';
  const isRevoked = cert.isRevoked;

  return (
    <div className="min-h-[80vh] bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Action Bar */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <Link to="/verify-certificate" className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              <FiExternalLink size={14} /> Verify Certificate
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {/* QR Toggle */}
            <button onClick={() => setShowQR(!showQR)} className="btn-outline flex items-center gap-2 text-sm py-2">
              <FiSquare size={16} /> {showQR ? 'Hide QR' : 'Show QR'}
            </button>
            {/* Download */}
            <button onClick={handleDownload} disabled={downloading} className="btn-primary flex items-center gap-2 text-sm py-2 disabled:opacity-50">
              {downloading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiDownload size={16} />}
              {downloading ? 'Downloading...' : 'Download PDF'}
            </button>
            {/* Share */}
            <div className="relative">
              <button onClick={() => setShowShareMenu(!showShareMenu)} className="btn-outline flex items-center gap-2 text-sm py-2">
                <FiShare2 size={16} /> Share
              </button>
              {showShareMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 card shadow-xl z-50 p-2 space-y-1">
                  <a href={shareLinks.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors text-sm">
                    <svg className="w-5 h-5 text-blue-700" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    Share on LinkedIn
                  </a>
                  <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors text-sm">
                    <svg className="w-5 h-5 text-dark-900 dark:text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    Share on X (Twitter)
                  </a>
                  <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors text-sm">
                    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Share on Facebook
                  </a>
                  <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors text-sm">
                    <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Share on WhatsApp
                  </a>
                  <hr className="border-dark-200 dark:border-dark-700" />
                  <button onClick={() => { copyToClipboard(verificationUrl, 'url'); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors text-sm w-full text-left">
                    {copied === 'url' ? <FiCheck size={18} className="text-green-500" /> : <FiCopy size={18} className="text-dark-400" />}
                    {copied === 'url' ? 'Link Copied!' : 'Copy Verification Link'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Certificate Card */}
        <motion.div ref={certRef} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className={`relative overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-br ${config.gradient}`}>
            {/* Decorative elements */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
              <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
            </div>
            {/* Gold inner border */}
            <div className="absolute inset-4 border-2 border-white/20 rounded-xl" />
            <div className="absolute inset-6 border border-white/10 rounded-lg" />

            <div className="relative z-10 p-8 sm:p-12 text-white">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <img src="/stackamit-logo.jpg" alt="StackAmit" className="w-10 h-10 object-contain rounded-lg bg-white/20 backdrop-blur-sm" />
                  <span className="font-display font-bold text-xl tracking-wide">STACKAMIT</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-wide mb-2">CERTIFICATE</h1>
                <p className="text-white/70 text-lg">of {config.label}</p>
                <div className="w-24 h-0.5 bg-white/30 mx-auto mt-4" />
              </div>

              {/* Body */}
              <div className="text-center max-w-xl mx-auto mb-8">
                <p className="text-white/70 text-sm mb-3">This is to certify that</p>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">{studentName}</h2>
                <div className="w-48 h-px bg-white/30 mx-auto mb-4" />
                <p className="text-white/70 text-sm mb-2">has successfully completed the</p>
                <h3 className="text-xl sm:text-2xl font-semibold mb-3">{cert.internshipTitle}</h3>
                {cert.duration && <p className="text-white/60 text-sm mb-1">Duration: {cert.duration}</p>}
                {cert.internshipId?.startDate && cert.internshipId?.endDate && (
                  <p className="text-white/50 text-xs">
                    {formatDate(cert.internshipId.startDate)} — {formatDate(cert.internshipId.endDate)}
                  </p>
                )}
                {cert.internshipId?.category && (
                  <span className="inline-block mt-3 px-3 py-1 bg-white/15 rounded-full text-xs font-medium backdrop-blur-sm">
                    {cert.internshipId.category}
                  </span>
                )}
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/15">
                <div>
                  <p className="text-white/50 text-xs">Issued on</p>
                  <p className="text-white/90 text-sm font-medium">{formatDate(cert.issuedDate || cert.createdAt)}</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-xs text-white/50">{cert.certificateNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/50 text-xs">Type</p>
                  <p className="text-white/90 text-sm font-medium capitalize">{config.label}</p>
                </div>
              </div>

              {/* Revoked banner */}
              {isRevoked && (
                <div className="mt-6 p-4 bg-red-500/30 border border-red-400/50 rounded-xl flex items-center gap-3 backdrop-blur-sm">
                  <FiAlertTriangle size={24} className="text-red-300 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-red-200">Certificate Revoked</p>
                    <p className="text-red-300/80 text-sm">This certificate has been revoked and is no longer valid.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* QR Code Section */}
        {showQR && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6">
            <div className="card p-6 text-center">
              <h3 className="font-semibold text-dark-900 dark:text-white mb-4 flex items-center justify-center gap-2">
                <FiSquare size={20} /> Scan to Verify
              </h3>
              <div className="bg-white p-4 rounded-xl inline-block mb-4">
                <QRCodeSVG
                  value={certificate?.verificationUrl || ''}
                  size={200}
                  fgColor="#1e3a5f"
                  bgColor="#ffffff"
                  level="H"
                  includeMargin={false}
                />
              </div>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                Scan this QR code to verify the certificate authenticity
              </p>
              <button onClick={() => copyToClipboard(certificate?.verificationUrl || '', 'qr-url')} className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center justify-center gap-1 mx-auto">
                {copied === 'qr-url' ? <><FiCheck size={14} /> Copied!</> : <><FiCopy size={14} /> Copy verification URL</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* Certificate Details */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6">
          <div className="card p-6">
            <h3 className="font-semibold text-dark-900 dark:text-white mb-4">Certificate Details</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiHash size={16} className="text-primary-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-dark-400">Certificate Number</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-semibold text-dark-900 dark:text-white text-sm truncate">{cert.certificateNumber}</p>
                    <button onClick={() => copyToClipboard(cert.certificateNumber, 'certNum')} className="text-dark-400 hover:text-primary-500 flex-shrink-0">
                      {copied === 'certNum' ? <FiCheck size={14} className="text-green-500" /> : <FiCopy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiAward size={16} className="text-primary-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-dark-400">Type</p>
                  <p className="font-semibold text-dark-900 dark:text-white text-sm capitalize">{config.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiUser size={16} className="text-primary-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-dark-400">Recipient</p>
                  <p className="font-semibold text-dark-900 dark:text-white text-sm">{studentName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiBriefcase size={16} className="text-primary-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-dark-400">Internship Program</p>
                  <p className="font-semibold text-dark-900 dark:text-white text-sm">{cert.internshipTitle}</p>
                </div>
              </div>
              {cert.duration && (
                <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                  <FiClock size={16} className="text-primary-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-dark-400">Duration</p>
                    <p className="font-semibold text-dark-900 dark:text-white text-sm">{cert.duration}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                <FiCalendar size={16} className="text-primary-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-dark-400">Issue Date</p>
                  <p className="font-semibold text-dark-900 dark:text-white text-sm">{formatDate(cert.issuedDate || cert.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg sm:col-span-2">
                <FiCheckCircle size={16} className={`flex-shrink-0 ${isRevoked ? 'text-red-500' : 'text-green-500'}`} />
                <div>
                  <p className="text-xs text-dark-400">Status</p>
                  <p className={`font-semibold text-sm ${isRevoked ? 'text-red-500' : 'text-green-500'}`}>
                    {isRevoked ? 'Revoked' : 'Valid & Active'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Share Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6 mb-10">
          <div className="card p-6">
            <h3 className="font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
              <FiShare2 size={18} /> Share Your Achievement
            </h3>
            <p className="text-sm text-dark-500 dark:text-dark-400 mb-4">Share your certificate with your professional network</p>
            <div className="flex flex-wrap gap-3">
              <a href={shareLinks.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-[#0077B5] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </a>
              <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-dark-900 dark:bg-white text-white dark:text-dark-900 rounded-lg hover:opacity-90 transition-opacity text-sm font-medium">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                X (Twitter)
              </a>
              <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-[#1877F2] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </a>
              <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CertificateViewPage;
