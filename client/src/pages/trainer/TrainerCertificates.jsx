import { useState, useEffect } from 'react';
import { FiAward, FiSearch, FiRefreshCw, FiX, FiShield } from 'react-icons/fi';
import api from '../../services/api';

const TrainerCertificates = () => {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [students, setStudents] = useState([]);
  const [internships, setInternships] = useState([]);
  const [genForm, setGenForm] = useState({ studentId: '', internshipId: '', type: 'completion' });
  const [generating, setGenerating] = useState(false);

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

  const openGenerate = async () => {
    setShowGenerate(true);
    try {
      const [sRes, iRes] = await Promise.all([api.get('/students', { params: { limit: 100 } }), api.get('/internships', { params: { limit: 100 } })]);
      setStudents(sRes.data.data.students);
      setInternships(iRes.data.data.internships);
    } catch (err) { console.error(err); }
  };

  const handleGenerate = async (e) => {
    e.preventDefault(); setGenerating(true);
    try {
      await api.post('/certificates/generate', genForm);
      setShowGenerate(false); setGenForm({ studentId: '', internshipId: '', type: 'completion' });
      fetchCertificates();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    finally { setGenerating(false); }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const typeColor = (t) => ({ completion: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', participation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', merit: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }[t] || '');

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="page-title">Certificates</h1><p className="page-subtitle">Issue and view certificates</p></div>
        <div className="flex items-center gap-3">
          <button onClick={fetchCertificates} className="btn-outline flex items-center gap-2 text-sm"><FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={openGenerate} className="btn-primary flex items-center gap-2 text-sm"><FiAward size={16} /> Generate</button>
        </div>
      </div>

      <div className="table-container mb-6">
        <div className="table-header">
          <div className="relative flex-1"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search certificates..." /></div>
        </div>
      </div>

      {loading ? (<div className="flex items-center justify-center py-12"><FiRefreshCw size={24} className="animate-spin text-primary-500" /></div>)
      : certificates.length === 0 ? (<div className="table-container p-12 text-center text-dark-400"><FiAward size={40} className="mx-auto mb-3 opacity-30" /><p className="text-lg font-medium">No certificates issued yet</p></div>)
      : (
        <div className="overflow-x-auto table-container">
          <table className="w-full">
            <thead className="bg-dark-50 dark:bg-dark-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Cert #</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Student</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Internship</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Issued</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
              {certificates.map(c => (
                <tr key={c._id} className="hover:bg-dark-50 dark:hover:bg-dark-800/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm font-medium text-dark-900 dark:text-white">{c.certificateNumber}</td>
                  <td className="px-6 py-4 text-sm text-dark-600 dark:text-dark-300">{c.studentName || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-dark-600 dark:text-dark-300">{c.internshipTitle || 'N/A'}</td>
                  <td className="px-6 py-4"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${typeColor(c.type)}`}>{c.type}</span></td>
                  <td className="px-6 py-4 text-sm text-dark-500">{formatDate(c.issuedDate || c.createdAt)}</td>
                  <td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.isRevoked ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${c.isRevoked ? 'bg-red-500' : 'bg-green-500'}`}></span>{c.isRevoked ? 'Revoked' : 'Valid'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowGenerate(false)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-dark-900 dark:text-white">Generate Certificate</h2><button onClick={() => setShowGenerate(false)}><FiX size={20} className="text-dark-400" /></button></div>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div><label className="label">Student *</label><select required value={genForm.studentId} onChange={e => setGenForm({ ...genForm, studentId: e.target.value })} className="input-field"><option value="">Select student</option>{students.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
              <div><label className="label">Internship *</label><select required value={genForm.internshipId} onChange={e => setGenForm({ ...genForm, internshipId: e.target.value })} className="input-field"><option value="">Select internship</option>{internships.map(i => <option key={i._id} value={i._id}>{i.title}</option>)}</select></div>
              <div><label className="label">Type *</label><select value={genForm.type} onChange={e => setGenForm({ ...genForm, type: e.target.value })} className="input-field"><option value="completion">Completion</option><option value="participation">Participation</option><option value="merit">Merit</option></select></div>
              <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowGenerate(false)} className="btn-outline text-sm">Cancel</button><button type="submit" disabled={generating} className="btn-primary text-sm">{generating ? 'Generating...' : 'Generate'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerCertificates;
