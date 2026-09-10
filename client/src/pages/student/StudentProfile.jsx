import { useState, useEffect } from 'react';
import { FiSave, FiUpload, FiRefreshCw, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const StudentProfile = () => {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', gender: '', dob: '',
    collegeName: '', university: '', course: '', branch: '', year: '',
    address: '', city: '', state: '', country: '', pinCode: '',
    linkedIn: '', gitHub: '', skills: '',
  });
  const [profileCompletion, setProfileCompletion] = useState(0);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/students/${user._id}`);
      const s = data.data.student;
      setForm({
        firstName: s.firstName || '', lastName: s.lastName || '', phone: s.phone || '',
        gender: s.gender || '', dob: s.dob ? s.dob.split('T')[0] : '',
        collegeName: s.collegeName || '', university: s.university || '',
        course: s.course || '', branch: s.branch || '', year: s.year || '',
        address: s.address || '', city: s.city || '', state: s.state || '',
        country: s.country || '', pinCode: s.pinCode || '',
        linkedIn: s.linkedIn || '', gitHub: s.gitHub || '',
        skills: Array.isArray(s.skills) ? s.skills.join(', ') : (s.skills || ''),
      });
      setProfileCompletion(s.profileCompletion || 0);
    } catch (err) { console.error('Failed to fetch profile:', err); }
    finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setMessage({ type: '', text: '' });
    try {
      const payload = { ...form, skills: form.skills.split(',').map(s => s.trim()).filter(Boolean) };
      const { data } = await api.put('/students/profile', payload);
      setProfileCompletion(data.data.student.profileCompletion || 0);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update' }); }
    finally { setSaving(false); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const { data } = await api.post('/students/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.data.avatar) {
        const updatedUser = { ...user, avatar: data.data.avatar };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      setMessage({ type: 'success', text: 'Avatar uploaded!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) { alert('Failed to upload avatar'); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><FiRefreshCw size={24} className="animate-spin text-primary-500" /></div>;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="page-title">My Profile</h1><p className="page-subtitle">Manage your personal information</p></div>
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className="text-dark-500">Profile: </span>
            <strong className={profileCompletion >= 80 ? 'text-green-500' : profileCompletion >= 50 ? 'text-yellow-500' : 'text-red-500'}>{profileCompletion}%</strong>
          </div>
          <button onClick={fetchProfile} className="btn-outline flex items-center gap-2 text-sm"><FiRefreshCw size={16} /></button>
        </div>
      </div>

      {message.text && (
        <div className={`mb-6 flex items-center gap-2 p-4 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
          {message.type === 'success' ? <FiCheck size={18} /> : <FiAlertCircle size={18} />}{message.text}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="card p-6 text-center">
            {user?.avatar?.url ? (
              <img src={user.avatar.url} alt="" className="w-24 h-24 rounded-full object-cover mx-auto" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-500 to-purple-300 flex items-center justify-center text-white text-3xl font-bold mx-auto">{user?.name?.charAt(0)?.toUpperCase()}</div>
            )}
            <h3 className="mt-4 font-semibold text-dark-900 dark:text-white">{user?.name}</h3>
            <p className="text-sm text-dark-500">{user?.email}</p>
            <label className="btn-outline mt-4 text-sm flex items-center gap-2 mx-auto cursor-pointer">
              <FiUpload size={14} /> Upload Photo
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
            <div className="mt-6">
              <div className="w-full bg-dark-100 dark:bg-dark-700 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${profileCompletion}%` }}></div>
              </div>
              <p className="text-xs text-dark-400 mt-1">{profileCompletion}% complete</p>
            </div>
          </div>

          <div className="lg:col-span-2 card p-6">
            <h3 className="font-semibold text-dark-900 dark:text-white mb-4">Personal Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="label">First Name</label><input className="input-field" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><label className="label">Last Name</label><input className="input-field" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
              <div><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label">Gender</label><select className="input-field" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
              <div><label className="label">Date of Birth</label><input type="date" className="input-field" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></div>
              <div><label className="label">College</label><input className="input-field" value={form.collegeName} onChange={e => setForm({ ...form, collegeName: e.target.value })} /></div>
              <div><label className="label">University</label><input className="input-field" value={form.university} onChange={e => setForm({ ...form, university: e.target.value })} /></div>
              <div><label className="label">Course</label><input className="input-field" value={form.course} onChange={e => setForm({ ...form, course: e.target.value })} /></div>
              <div><label className="label">Branch</label><input className="input-field" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} /></div>
              <div><label className="label">Year</label><select className="input-field" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}><option value="">Select</option>{['1st', '2nd', '3rd', '4th', '5th'].map(y => <option key={y} value={y}>{y}</option>)}</select></div>
              <div><label className="label">LinkedIn</label><input className="input-field" value={form.linkedIn} onChange={e => setForm({ ...form, linkedIn: e.target.value })} placeholder="https://linkedin.com/in/..." /></div>
              <div><label className="label">GitHub</label><input className="input-field" value={form.gitHub} onChange={e => setForm({ ...form, gitHub: e.target.value })} placeholder="https://github.com/..." /></div>
              <div className="sm:col-span-2"><label className="label">Skills (comma separated)</label><input className="input-field" value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="React, Node.js, MongoDB" /></div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary mt-6 flex items-center gap-2 text-sm"><FiSave size={16} /> {saving ? 'Saving...' : 'Save Profile'}</button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default StudentProfile;
