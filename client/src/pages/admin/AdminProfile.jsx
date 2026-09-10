  import { useState, useEffect } from 'react';
import { FiSave, FiRefreshCw, FiCheck, FiAlertCircle, FiShield, FiMail, FiClock, FiKey } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const AdminProfile = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    name: '',
    phone: '',
  });
  const [profileData, setProfileData] = useState(null);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/me');
      const u = data.data.user;
      setProfileData(u);
      setForm({
        name: u.name || '',
        phone: u.phone || '',
      });
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setMessage({ type: 'error', text: 'Failed to load profile data.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const { data } = await api.put('/auth/profile', {
        name: form.name,
        phone: form.phone,
      });
      const updatedUser = data.data.user;
      setUser(updatedUser);
      setProfileData(updatedUser);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : 'N/A';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FiRefreshCw size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account information</p>
        </div>
        <button onClick={fetchProfile} className="btn-outline flex items-center gap-2 text-sm self-start">
          <FiRefreshCw size={16} /> Refresh
        </button>
      </div>

      {message.text && (
        <div className={`mb-6 flex items-center gap-2 p-4 rounded-xl text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <FiCheck size={18} /> : <FiAlertCircle size={18} />}
          {message.text}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left - Profile Card */}
        <div className="card p-6 text-center">
          {profileData?.avatar?.url ? (
            <img
              src={profileData.avatar.url}
              alt={profileData.name}
              className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-primary-100 dark:ring-primary-900/30"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-primary-600 to-primary-400 flex items-center justify-center text-white text-3xl font-bold mx-auto ring-4 ring-primary-100 dark:ring-primary-900/30">
              {profileData?.name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <h3 className="mt-4 font-semibold text-dark-900 dark:text-white text-lg">{profileData?.name}</h3>
          <p className="text-sm text-dark-500 dark:text-dark-400">{profileData?.email}</p>
          <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium capitalize">
            <FiShield size={12} /> {profileData?.role}
          </span>

          {/* Account Info */}
          <div className="mt-6 space-y-3 text-left">
            <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-xl">
              <FiMail size={16} className="text-dark-400" />
              <div>
                <p className="text-xs text-dark-400">Email</p>
                <p className="text-sm text-dark-700 dark:text-dark-300">{profileData?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-xl">
              <FiClock size={16} className="text-dark-400" />
              <div>
                <p className="text-xs text-dark-400">Last Login</p>
                <p className="text-sm text-dark-700 dark:text-dark-300">{formatDate(profileData?.lastLogin)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-xl">
              <FiShield size={16} className="text-dark-400" />
              <div>
                <p className="text-xs text-dark-400">Account Status</p>
                <p className="text-sm">
                  <span className={`inline-flex items-center gap-1 ${profileData?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${profileData?.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                    {profileData?.isActive ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-xl">
              <FiKey size={16} className="text-dark-400" />
              <div>
                <p className="text-xs text-dark-400">Member Since</p>
                <p className="text-sm text-dark-700 dark:text-dark-300">{formatDate(profileData?.createdAt)}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/change-password')}
            className="btn-outline mt-6 text-sm w-full flex items-center justify-center gap-2"
          >
            <FiKey size={14} /> Change Password
          </button>
        </div>

        {/* Right - Edit Form */}
        <div className="lg:col-span-2 card p-6">
          <h3 className="font-semibold text-dark-900 dark:text-white mb-6">Edit Profile</h3>
          <form onSubmit={handleSave}>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Your full name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input-field"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  className="input-field bg-dark-50 dark:bg-dark-800/50 cursor-not-allowed"
                  value={profileData?.email || ''}
                  disabled
                />
                <p className="text-xs text-dark-400 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="label">Role</label>
                <input
                  className="input-field bg-dark-50 dark:bg-dark-800/50 cursor-not-allowed capitalize"
                  value={profileData?.role || ''}
                  disabled
                />
                <p className="text-xs text-dark-400 mt-1">Role is managed by the system</p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-dark-100 dark:border-dark-700">
              <p className="text-xs text-dark-400">
                {profileData?.isVerified
                  ? <span className="flex items-center gap-1 text-green-500"><FiCheck size={14} /> Verified account</span>
                  : <span className="flex items-center gap-1 text-yellow-500"><FiAlertCircle size={14} /> Unverified account</span>
                }
              </p>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <FiSave size={16} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
