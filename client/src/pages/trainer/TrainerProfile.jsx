import { useState, useEffect } from 'react';
import {
  FiSave, FiRefreshCw, FiCheck, FiAlertCircle, FiShield, FiMail,
  FiClock, FiKey, FiX, FiPlus, FiUsers, FiStar, FiBookOpen,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const TrainerProfile = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    name: '',
    phone: '',
    bio: '',
  });
  const [expertise, setExpertise] = useState([]);
  const [newSkill, setNewSkill] = useState('');
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
        bio: u.bio || '',
      });
      setExpertise(u.expertise || []);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setMessage({ type: 'error', text: 'Failed to load profile data.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkill = (e) => {
    e.preventDefault();
    const trimmed = newSkill.trim();
    if (trimmed && !expertise.includes(trimmed)) {
      setExpertise([...expertise, trimmed]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill) => {
    setExpertise(expertise.filter(s => s !== skill));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const { data } = await api.put('/trainers/profile', {
        name: form.name,
        phone: form.phone,
        bio: form.bio,
        expertise,
      });
      const updatedUser = data.data.trainer;
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
          <p className="page-subtitle">Manage your trainer profile and expertise</p>
        </div>
        <button onClick={fetchProfile} className="btn-outline flex items-center gap-2 text-sm self-start">
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
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
              className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-secondary-100 dark:ring-secondary-900/30"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-secondary-600 to-secondary-400 flex items-center justify-center text-white text-3xl font-bold mx-auto ring-4 ring-secondary-100 dark:ring-secondary-900/30">
              {profileData?.name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <h3 className="mt-4 font-semibold text-dark-900 dark:text-white text-lg">{profileData?.name}</h3>
          <p className="text-sm text-dark-500 dark:text-dark-400">{profileData?.email}</p>
          <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300 rounded-full text-xs font-medium capitalize">
            <FiShield size={12} /> Trainer
          </span>

          {/* Trainer Stats */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-dark-900 dark:text-white">{profileData?.assignedStudents?.length || 0}</p>
              <p className="text-xs text-dark-400">Students</p>
            </div>
            <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-dark-900 dark:text-white">{profileData?.maxStudents || 20}</p>
              <p className="text-xs text-dark-400">Max Cap</p>
            </div>
            <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-dark-900 dark:text-white">{(profileData?.rating || 0).toFixed(1)}</p>
              <p className="text-xs text-dark-400">Rating</p>
            </div>
          </div>

          {/* Account Info */}
          <div className="mt-5 space-y-3 text-left">
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
                  placeholder="+91 98765 43210"
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

            {/* Bio */}
            <div className="mt-6">
              <label className="label flex items-center gap-2">
                <FiBookOpen size={14} /> Bio / About
              </label>
              <textarea
                className="input-field"
                value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell students about your experience, teaching style, and background..."
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-dark-400 mt-1">{form.bio.length}/500 characters</p>
            </div>

            {/* Expertise Tags */}
            <div className="mt-6">
              <label className="label flex items-center gap-2">
                <FiStar size={14} /> Areas of Expertise
              </label>
              <div className="flex items-center gap-2">
                <input
                  className="input-field flex-1"
                  value={newSkill}
                  onChange={e => setNewSkill(e.target.value)}
                  placeholder="e.g. React, Python, Machine Learning..."
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill(e);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="btn-outline flex items-center gap-1 text-sm"
                >
                  <FiPlus size={14} /> Add
                </button>
              </div>
              {expertise.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {expertise.map((skill, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <FiX size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-dark-400 mt-2">No expertise added yet. Add your skills above.</p>
              )}
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

export default TrainerProfile;
