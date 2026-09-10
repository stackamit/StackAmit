import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiSearch, FiCheckCircle, FiXCircle, FiAward, FiUser,
  FiBriefcase, FiClock, FiHash, FiShield, FiAlertTriangle, FiCamera,
} from 'react-icons/fi';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const typeLabels = {
  completion: { label: 'Completion', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  participation: { label: 'Participation', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  merit: { label: 'Merit', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
};

const VerifyCertificatePage = () => {
  const [searchParams] = useSearchParams();
  const prefill = searchParams.get('certificateNumber') || '';

  const [query, setQuery] = useState(prefill);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    setSearched(true);

    try {
      const { data } = await axios.get(`${API_URL}/api/certificates/verify`, {
        params: { certificateNumber: query.trim() },
      });
      setResult(data.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No certificate found with this number. Please check and try again.');
      } else {
        setError('Something went wrong. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  return (
    <div className="min-h-[80vh] bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiShield size={32} className="text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-dark-900 dark:text-white">
            Verify Certificate
          </h1>
          <p className="mt-3 text-dark-500 dark:text-dark-400 text-lg">
            Enter the certificate number to verify its authenticity
          </p>
          <Link to="/scan-certificate" className="inline-flex items-center gap-2 mt-3 text-primary-600 dark:text-primary-400 hover:underline text-sm">
            <FiCamera size={16} /> Or scan QR code instead
          </Link>
        </motion.div>

        {/* Search Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleVerify}
          className="card p-6 mb-8"
        >
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
            Certificate Number
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <FiHash className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input-field pl-11 py-3 text-lg"
                placeholder="e.g. MTC-2026-00001"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="btn-primary px-6 py-3 flex items-center gap-2 text-base disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FiSearch size={18} />
              )}
              <span className="hidden sm:inline">{loading ? 'Verifying...' : 'Verify'}</span>
            </button>
          </div>
          <p className="text-xs text-dark-400 mt-2">
            The certificate number is printed on the certificate (format: MTC-YYYY-XXXXX)
          </p>
        </motion.form>

        {/* Result */}
        {searched && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {/* Error state */}
            {error && (
              <div className="card p-8 text-center">
                <FiXCircle size={48} className="mx-auto text-red-400 mb-4" />
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                  Certificate Not Found
                </h3>
                <p className="text-dark-500 dark:text-dark-400">{error}</p>
              </div>
            )}

            {/* Revoked state */}
            {result?.isRevoked && (
              <div className="card p-6 border-2 border-red-200 dark:border-red-800">
                <div className="flex items-center gap-3 mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <FiAlertTriangle size={28} className="text-red-500 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-red-700 dark:text-red-400 text-lg">Certificate Revoked</h3>
                    <p className="text-red-600 dark:text-red-400/80 text-sm">
                      This certificate has been revoked and is no longer valid.
                      {result.message && ` ${result.message}`}
                    </p>
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
                    <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg sm:col-span-2">
                      <FiAlertTriangle size={16} className="text-red-400" />
                      <div>
                        <p className="text-xs text-red-400">Revoke Reason</p>
                        <p className="font-semibold text-red-700 dark:text-red-400 text-sm">{result.certificate.revokeReason}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Valid state */}
            {result?.isValid && (
              <div className="card p-6 border-2 border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3 mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <FiCheckCircle size={28} className="text-green-500 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-green-700 dark:text-green-400 text-lg">Certificate Verified</h3>
                    <p className="text-green-600 dark:text-green-400/80 text-sm">
                      This certificate is authentic and currently valid.
                    </p>
                  </div>
                </div>

                {/* Certificate Card */}
                <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-6 text-white mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <img src="/stackamit-logo.jpg" alt="StackAmit" className="w-8 h-8 object-contain rounded-lg bg-white/20" />
                      <span className="font-display font-bold">StackAmit</span>
                    </div>
                    <FiAward size={24} className="text-white/60" />
                  </div>
                  <div className="text-center py-4">
                    <p className="text-white/60 text-sm uppercase tracking-wider mb-1">Certificate of {typeLabels[result.certificate.type]?.label || result.certificate.type}</p>
                    <p className="text-2xl font-bold">{result.certificate.studentName}</p>
                    <p className="text-white/80 mt-2">{result.certificate.internshipTitle}</p>
                    {result.certificate.duration && (
                      <p className="text-white/60 text-sm mt-1">Duration: {result.certificate.duration}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/60">
                    <span>Issued: {formatDate(result.certificate.issuedDate)}</span>
                    <span className="font-mono">{result.certificate.certificateNumber}</span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid sm:grid-cols-2 gap-4">
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
                      <p className="text-xs text-dark-400">Student Name</p>
                      <p className="font-semibold text-dark-900 dark:text-white text-sm">{result.certificate.studentName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                    <FiBriefcase size={16} className="text-primary-500" />
                    <div>
                      <p className="text-xs text-dark-400">Internship Program</p>
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
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default VerifyCertificatePage;
