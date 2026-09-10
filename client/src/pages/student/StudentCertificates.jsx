import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiAward, FiRefreshCw, FiCheckCircle, FiXCircle, FiSearch, FiEye, FiDownload, FiShare2 } from 'react-icons/fi';
import api from '../../services/api';

const StudentCertificates = () => {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchCertificates(); }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const { data } = await api.get('/certificates', { params });
      setCertificates(data.data.certificates);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const typeColor = (t) => ({ completion: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', participation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', merit: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }[t] || '');

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="page-title">My Certificates</h1><p className="page-subtitle">View your earned certificates</p></div>
        <button onClick={fetchCertificates} className="btn-outline flex items-center gap-2 text-sm self-start"><FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      <div className="table-container mb-6">
        <div className="table-header">
          <div className="relative flex-1"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search certificates..." /></div>
        </div>
      </div>

      {loading ? (<div className="flex items-center justify-center py-12"><FiRefreshCw size={24} className="animate-spin text-primary-500" /></div>)
      : certificates.length === 0 ? (<div className="table-container p-12 text-center text-dark-400"><FiAward size={48} className="mx-auto mb-4 opacity-50" /><p className="text-lg font-medium">No certificates yet</p><p className="text-sm mt-1">Complete internships to earn certificates.</p></div>)
      : (
        <div className="grid gap-4 sm:grid-cols-2">
          {certificates.map(c => (
            <div key={c._id} className={`card p-6 border-l-4 ${c.isRevoked ? 'border-l-red-500 opacity-60' : 'border-l-green-500'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.isRevoked ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                    {c.isRevoked ? <FiXCircle size={24} className="text-red-500" /> : <FiCheckCircle size={24} className="text-green-500" />}
                  </div>
                  <div>
                    <p className="font-mono text-sm font-bold text-dark-900 dark:text-white">{c.certificateNumber}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${typeColor(c.type)}`}>{c.type}</span>
                  </div>
                </div>
                <span className={`text-xs font-medium ${c.isRevoked ? 'text-red-500' : 'text-green-500'}`}>{c.isRevoked ? 'Revoked' : 'Valid'}</span>
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-sm font-medium text-dark-900 dark:text-white">{c.internshipTitle}</p>
                {c.duration && <p className="text-xs text-dark-400">Duration: {c.duration}</p>}
                <p className="text-xs text-dark-400">Issued: {formatDate(c.issuedDate || c.createdAt)}</p>
                {c.isRevoked && c.revokeReason && <p className="text-xs text-red-500 mt-1">Reason: {c.revokeReason}</p>}
              </div>
              {!c.isRevoked && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/certificate/${c._id}`} className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs font-medium">
                    <FiEye size={14} /> View
                  </Link>
                  <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/certificates/${c._id}/download`} className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 rounded-lg hover:bg-dark-200 dark:hover:bg-dark-600 transition-colors text-xs font-medium">
                    <FiDownload size={14} /> PDF
                  </a>
                  <Link to={`/certificate/${c._id}`} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 rounded-lg hover:bg-dark-200 dark:hover:bg-dark-600 transition-colors text-xs font-medium">
                    <FiShare2 size={14} />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentCertificates;
