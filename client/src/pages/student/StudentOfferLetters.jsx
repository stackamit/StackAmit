import { useState, useEffect } from 'react';
import { FiFileText, FiRefreshCw, FiDownload, FiCheckCircle, FiCalendar, FiBriefcase, FiSearch, FiEye } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

const StudentOfferLetters = () => {
  const [offerLetters, setOfferLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => { fetchOfferLetters(); }, []);

  const fetchOfferLetters = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/applications/offer-letters');
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
      const title = (offer.internshipId?.title || 'Offer-Letter').replace(/[^a-z0-9]+/gi, '-');
      const fileName = `Offer-Letter-${title}.pdf`;
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

  const filtered = search
    ? offerLetters.filter(o => {
        const title = (o.internshipId?.title || '').toLowerCase();
        const category = (o.internshipId?.category || '').toLowerCase();
        return title.includes(search.toLowerCase()) || category.includes(search.toLowerCase());
      })
    : offerLetters;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">My Offer Letters</h1>
          <p className="page-subtitle">View and download your internship offer letters</p>
        </div>
        <button onClick={fetchOfferLetters} className="btn-outline flex items-center gap-2 text-sm self-start">
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="table-container mb-6">
        <div className="table-header">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search offer letters..." />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <FiRefreshCw size={24} className="animate-spin text-primary-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="table-container p-12 text-center text-dark-400">
          <FiFileText size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No offer letters yet</p>
          <p className="text-sm mt-1">Your offer letters will appear here when your internship applications are approved.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((offer) => {
            const internship = offer.internshipId;
            return (
              <div key={offer._id} className="card p-6 border-l-4 border-l-green-500">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-100 dark:bg-green-900/30">
                      <FiCheckCircle size={24} className="text-green-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-dark-900 dark:text-white">{internship?.title || 'Internship'}</p>
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Approved
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  {internship?.category && (
                    <p className="text-xs text-dark-500 dark:text-dark-400">
                      <span className="font-medium">Category:</span> {internship.category}
                    </p>
                  )}
                  {internship?.duration && (
                    <p className="text-xs text-dark-500 dark:text-dark-400">
                      <span className="font-medium">Duration:</span> {internship.duration.weeks} weeks ({internship.duration.hoursPerWeek || 20} hrs/week)
                    </p>
                  )}
                  <p className="text-xs text-dark-500 dark:text-dark-400 flex items-center gap-1">
                    <FiCalendar size={12} />
                    <span className="font-medium">Offer Date:</span> {formatDate(offer.reviewedAt || offer.updatedAt)}
                  </p>
                  {offer.reviewedBy?.name && (
                    <p className="text-xs text-dark-500 dark:text-dark-400">
                      <span className="font-medium">Approved By:</span> {offer.reviewedBy.name}
                    </p>
                  )}
                </div>

                {internship?.skills?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {internship.skills.slice(0, 4).map((skill, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400">{skill}</span>
                    ))}
                    {internship.skills.length > 4 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-700 text-dark-500">+{internship.skills.length - 4}</span>
                    )}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-dark-100 dark:border-dark-700 flex flex-wrap gap-2">
                  <button
                    onClick={() => handlePDF(offer, 'view')}
                    disabled={downloadingId === offer._id}
                    className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 rounded-lg hover:bg-dark-200 dark:hover:bg-dark-600 transition-colors text-xs font-medium disabled:opacity-50"
                  >
                    <FiEye size={14} /> {downloadingId === offer._id ? 'Loading...' : 'View PDF'}
                  </button>
                  <button
                    onClick={() => handlePDF(offer, 'download')}
                    disabled={downloadingId === offer._id}
                    className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium disabled:opacity-50"
                  >
                    <FiDownload size={14} /> {downloadingId === offer._id ? 'Loading...' : 'Download PDF'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentOfferLetters;
