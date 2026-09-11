import { useState, useEffect } from 'react';
import {
  FiFileText, FiRefreshCw, FiDownload, FiCheckCircle, FiSearch,
  FiUser, FiBriefcase, FiCalendar, FiFilter, FiMail, FiEye,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

const AdminOfferLetters = () => {
  const [offerLetters, setOfferLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  useEffect(() => { fetchOfferLetters(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchOfferLetters(), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchOfferLetters = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (search) params.search = search;
      const { data } = await api.get('/applications/offer-letters/all', { params });
      setOfferLetters(data?.data?.offerLetters || []);
    } catch (err) {
      console.error('Failed to fetch offer letters:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

  const handlePDF = async (offer, mode = 'download') => {
    if (downloadingId) return;
    setDownloadingId(offer._id);
    try {
      const res = await api.get(`/applications/offer-letters/${offer._id}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const studentName = getStudentName(offer).replace(/[^a-z0-9]+/gi, '-');
      const fileName = `Offer-Letter-${studentName}.pdf`;
      if (mode === 'view') {
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 5000);
        toast.success('Offer letter downloaded');
      }
    } catch (err) {
      console.error('Failed to get offer letter:', err);
      toast.error('Failed to download offer letter. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const resendEmail = async (offer) => {
    setResendingId(offer._id);
    try {
      const { data } = await api.post(`/applications/offer-letters/${offer._id}/resend-email`);
      toast.success(data.message || 'Offer letter email resent successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend offer letter email');
    } finally {
      setResendingId(null);
    }
  };

  const getStudentName = (app) => {
    if (!app.studentId) return 'Unknown';
    if (app.studentId.name) return app.studentId.name;
    return `${app.studentId.firstName || ''} ${app.studentId.lastName || ''}`.trim() || 'Unknown';
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Offer Letters</h1>
          <p className="page-subtitle">Manage all internship offer letters issued to students</p>
        </div>
        <button onClick={fetchOfferLetters} className="btn-outline flex items-center gap-2 text-sm self-start">
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center border-l-4 border-l-green-400">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{offerLetters.length}</p>
          <p className="text-xs text-dark-400 mt-1">Total Offer Letters</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-dark-900 dark:text-white">
            {new Set(offerLetters.map(o => o.studentId?._id).filter(Boolean)).size}
          </p>
          <p className="text-xs text-dark-400 mt-1">Unique Students</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-dark-900 dark:text-white">
            {new Set(offerLetters.map(o => o.internshipId?.title).filter(Boolean)).size}
          </p>
          <p className="text-xs text-dark-400 mt-1">Internship Programs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="table-container mb-6">
        <div className="table-header flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search by student name, email, or internship..." />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <FiRefreshCw size={24} className="animate-spin text-primary-500" />
        </div>
      ) : offerLetters.length === 0 ? (
        <div className="table-container p-12 text-center text-dark-400">
          <FiFileText size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No offer letters issued yet</p>
          <p className="text-sm mt-1">Offer letters are automatically generated when you approve student applications.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {offerLetters.map((offer) => (
            <div key={offer._id} className="card p-6 border-l-4 border-l-green-500">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  {/* Student info */}
                  <div className="flex items-center gap-2">
                    <FiUser size={16} className="text-green-500" />
                    <span className="font-semibold text-dark-900 dark:text-white">{getStudentName(offer)}</span>
                    <span className="text-xs text-dark-400">{offer.studentId?.email}</span>
                  </div>
                  {/* Internship info */}
                  <div className="flex items-center gap-2">
                    <FiBriefcase size={16} className="text-primary-500" />
                    <span className="text-sm text-dark-700 dark:text-dark-300">{offer.internshipId?.title || 'Unknown Internship'}</span>
                    {offer.internshipId?.category && (
                      <span className="text-xs px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">{offer.internshipId.category}</span>
                    )}
                  </div>
                  {/* Meta */}
                  <div className="flex flex-wrap gap-4 text-xs text-dark-400">
                    <span className="flex items-center gap-1"><FiCalendar size={12} /> Offer Date: {formatDate(offer.reviewedAt || offer.updatedAt)}</span>
                    {offer.studentId?.collegeName && <span>College: {offer.studentId.collegeName}</span>}
                    {offer.studentId?.course && <span>Course: {offer.studentId.course}</span>}
                    {offer.internshipId?.duration && <span>Duration: {offer.internshipId.duration.weeks} weeks</span>}
                    {offer.reviewedBy?.name && <span>Approved By: {offer.reviewedBy.name}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex sm:flex-col items-center gap-2 sm:items-end">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <FiCheckCircle size={12} /> Issued
                  </span>
                  <button
                    onClick={() => handlePDF(offer, 'view')}
                    disabled={downloadingId === offer._id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 rounded-lg hover:bg-dark-200 dark:hover:bg-dark-600 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <FiEye size={12} /> {downloadingId === offer._id ? 'Loading...' : 'View'}
                  </button>
                  <button
                    onClick={() => handlePDF(offer, 'download')}
                    disabled={downloadingId === offer._id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <FiDownload size={12} /> {downloadingId === offer._id ? 'Loading...' : 'Download'}
                  </button>
                  <button
                    onClick={() => resendEmail(offer)}
                    disabled={resendingId === offer._id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium transition-colors disabled:opacity-50"
                    title="Resend offer letter email with PDF to student"
                  >
                    <FiMail size={12} /> {resendingId === offer._id ? 'Sending...' : 'Resend Email'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminOfferLetters;
