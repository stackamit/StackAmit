import { useState, useEffect } from 'react';
import { FiSearch, FiBriefcase, FiRefreshCw, FiClock, FiMapPin, FiUsers } from 'react-icons/fi';
import api from '../../services/api';

const StudentInternships = () => {
  const [internships, setInternships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [myApplications, setMyApplications] = useState([]);
  const [applying, setApplying] = useState(null);

  const categories = ['Web Development', 'Mobile Development', 'Data Science', 'Machine Learning', 'UI/UX Design', 'Digital Marketing', 'Cloud Computing', 'Cyber Security', 'DevOps', 'Blockchain', 'Artificial Intelligence', 'Business Analytics', 'Other'];

  useEffect(() => { fetchInternships(); fetchMyApplications(); }, []);

  const fetchInternships = async () => {
    setLoading(true);
    try {
      const params = { status: 'published' };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      const { data } = await api.get('/internships', { params });
      setInternships(data?.data?.internships || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchMyApplications = async () => {
    try { const { data } = await api.get('/applications/my'); setMyApplications(data.data.applications); }
    catch (err) { console.error(err); }
  };

  const handleApply = async (internshipId) => {
    if (!window.confirm('Apply for this internship?')) return;
    setApplying(internshipId);
    try { await api.post('/applications/apply', { internshipId }); fetchMyApplications(); }
    catch (err) { alert(err.response?.data?.message || 'Failed to apply'); }
    finally { setApplying(null); }
  };

  const hasApplied = (id) => myApplications.some(a => a.internshipId?._id === id);
  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="page-title">Browse Internships</h1><p className="page-subtitle">Find and apply for internship programs</p></div>
        <button onClick={fetchInternships} className="btn-outline flex items-center gap-2 text-sm self-start"><FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      <div className="table-container mb-6">
        <div className="table-header flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search internships..." /></div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input-field py-2 w-auto"><option value="">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </div>
      </div>

      {loading ? (<div className="flex items-center justify-center py-12"><FiRefreshCw size={24} className="animate-spin text-primary-500" /></div>)
      : internships.length === 0 ? (<div className="table-container p-12 text-center text-dark-400"><FiBriefcase size={48} className="mx-auto mb-4 opacity-50" /><p className="text-lg font-medium">No internships available</p><p className="text-sm mt-1">Check back later for new opportunities.</p></div>)
      : (
        <div className="grid gap-4">
          {internships.map(i => (
            <div key={i._id} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-dark-900 dark:text-white text-lg">{i.title}</h3>
                  <p className="text-sm text-dark-500 mt-1 line-clamp-2">{i.description}</p>
                  <div className="flex flex-wrap gap-3 mt-3 text-sm text-dark-400">
                    <span className="flex items-center gap-1"><FiMapPin size={14} />{i.category}</span>
                    <span className="flex items-center gap-1"><FiClock size={14} />{i.duration.weeks} weeks</span>
                    <span className="flex items-center gap-1"><FiUsers size={14} />{i.seats.total - i.seats.filled} seats left</span>
                    {i.deadline && <span className="text-orange-500">Deadline: {formatDate(i.deadline)}</span>}
                  </div>
                  {i.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">{i.skills.slice(0, 5).map((s, idx) => <span key={idx} className="px-2 py-0.5 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded text-xs">{s}</span>)}</div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {hasApplied(i._id) ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-medium">Applied</span>
                  ) : (
                    <button onClick={() => handleApply(i._id)} disabled={applying === i._id} className="btn-primary text-sm">{applying === i._id ? 'Applying...' : 'Apply Now'}</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentInternships;
