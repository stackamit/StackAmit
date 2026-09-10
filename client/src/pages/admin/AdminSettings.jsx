import { useState, useEffect } from 'react';
import { FiSave, FiRefreshCw, FiCheck, FiAlertCircle, FiGlobe, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import api from '../../services/api';

const TABS = [
  { id: 'general', label: 'General', icon: <FiGlobe size={16} /> },
  { id: 'confidential', label: 'Confidentials', icon: <FiLock size={16} /> },
];

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [rawSettings, setRawSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showSecrets, setShowSecrets] = useState({});

  // Form state
  const [form, setForm] = useState({});

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/settings');
      const raw = data.data.raw || [];
      setRawSettings(raw);
      const obj = {};
      raw.forEach(s => { obj[s.key] = s.value; });
      setForm(obj);
    } catch (err) { console.error('Failed to fetch settings:', err); }
    finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const tabKeys = activeTab === 'general' ? generalKeys : confidentialKeys;
      const updates = tabKeys.map(({ key, category, description }) => ({
        key,
        value: form[key] || '',
        category,
        description,
      }));
      await api.put('/settings/bulk', { settings: updates });
      setMessage({ type: 'success', text: `${activeTab === 'general' ? 'General' : 'Confidential'} settings saved successfully!` });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save settings' });
    } finally { setSaving(false); }
  };

  const toggleSecret = (key) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const val = (key, fallback = '') => form[key] || fallback;

  // ─── General Settings Keys ──────────────────────────────────────────────
  const generalKeys = [
    // Company
    { key: 'companyName', category: 'company', description: 'Company name', group: 'Company' },
    { key: 'companyEmail', category: 'company', description: 'Company email', group: 'Company' },
    { key: 'companyPhone', category: 'company', description: 'Company phone', group: 'Company' },
    { key: 'companyAddress', category: 'company', description: 'Company address', group: 'Company' },
    // Home - Hero
    { key: 'heroBadge', category: 'website', description: 'Hero badge text', group: 'Home - Hero' },
    { key: 'heroTitle', category: 'website', description: 'Hero title', group: 'Home - Hero' },
    { key: 'heroSubtitle', category: 'website', description: 'Hero subtitle/description', group: 'Home - Hero' },
    { key: 'statStudents', category: 'website', description: 'Students placed stat', group: 'Home - Stats' },
    { key: 'statTrainers', category: 'website', description: 'Expert trainers stat', group: 'Home - Stats' },
    { key: 'statSuccessRate', category: 'website', description: 'Success rate stat', group: 'Home - Stats' },
    // Home - Why Choose
    { key: 'whyTitle', category: 'website', description: 'Why choose us title', group: 'Home - Why Choose Us' },
    { key: 'whySubtitle', category: 'website', description: 'Why choose us subtitle', group: 'Home - Why Choose Us' },
    // Home - CTA
    { key: 'ctaTitle', category: 'website', description: 'CTA section title', group: 'Home - CTA' },
    { key: 'ctaSubtitle', category: 'website', description: 'CTA section subtitle', group: 'Home - CTA' },
    // About
    { key: 'aboutTitle', category: 'website', description: 'About page title', group: 'About Page' },
    { key: 'aboutSubtitle', category: 'website', description: 'About page subtitle', group: 'About Page' },
    { key: 'aboutMission', category: 'website', description: 'Mission statement', group: 'About Page' },
    { key: 'aboutVision', category: 'website', description: 'Vision statement', group: 'About Page' },
    { key: 'aboutValues', category: 'website', description: 'Values statement', group: 'About Page' },
    { key: 'aboutCommunity', category: 'website', description: 'Community description', group: 'About Page' },
    // Contact
    { key: 'contactTitle', category: 'website', description: 'Contact page title', group: 'Contact Page' },
    { key: 'contactSubtitle', category: 'website', description: 'Contact page subtitle', group: 'Contact Page' },
    { key: 'contactEmail', category: 'website', description: 'Contact email', group: 'Contact Page' },
    { key: 'contactPhone', category: 'website', description: 'Contact phone', group: 'Contact Page' },
    { key: 'contactAddress', category: 'website', description: 'Contact address', group: 'Contact Page' },
    // Social Media
    { key: 'socialLinkedin', category: 'website', description: 'LinkedIn URL', group: 'Social Media' },
    { key: 'socialYoutube', category: 'website', description: 'YouTube URL', group: 'Social Media' },
    { key: 'socialFacebook', category: 'website', description: 'Facebook URL', group: 'Social Media' },
    { key: 'socialInstagram', category: 'website', description: 'Instagram URL', group: 'Social Media' },
    { key: 'socialGithub', category: 'website', description: 'GitHub URL', group: 'Social Media' },
  ];

  // ─── Confidential Settings Keys ─────────────────────────────────────────
  const confidentialKeys = [
    { key: 'mongodbUri', category: 'confidential', description: 'MongoDB connection URI', group: 'Database' },
    { key: 'jwtSecret', category: 'confidential', description: 'JWT signing secret', group: 'Authentication' },
    { key: 'jwtExpire', category: 'confidential', description: 'JWT token expiry (e.g. 15m)', group: 'Authentication' },
    { key: 'jwtRefreshSecret', category: 'confidential', description: 'JWT refresh token secret', group: 'Authentication' },
    { key: 'jwtRefreshExpire', category: 'confidential', description: 'Refresh token expiry (e.g. 7d)', group: 'Authentication' },
    { key: 'sendgridApiKey', category: 'confidential', description: 'SendGrid API key', group: 'Email Service' },
    { key: 'emailFrom', category: 'confidential', description: 'Email from address', group: 'Email Service' },
    { key: 'cloudinaryCloudName', category: 'confidential', description: 'Cloudinary cloud name', group: 'Storage (Cloudinary)' },
    { key: 'cloudinaryApiKey', category: 'confidential', description: 'Cloudinary API key', group: 'Storage (Cloudinary)' },
    { key: 'cloudinaryApiSecret', category: 'confidential', description: 'Cloudinary API secret', group: 'Storage (Cloudinary)' },
    { key: 'certificateSecret', category: 'confidential', description: 'Certificate signing secret', group: 'Certificates' },
    { key: 'cookieSecret', category: 'confidential', description: 'Cookie signing secret', group: 'Security' },
    { key: 'bcryptSalt', category: 'confidential', description: 'Bcrypt salt rounds', group: 'Security' },
    { key: 'clientUrl', category: 'confidential', description: 'Frontend client URL', group: 'URLs' },
  ];

  // Group keys by group name
  const groupBy = (keys) => {
    const groups = {};
    keys.forEach(k => {
      if (!groups[k.group]) groups[k.group] = [];
      groups[k.group].push(k);
    });
    return groups;
  };

  const generalGroups = groupBy(generalKeys);
  const confidentialGroups = groupBy(confidentialKeys);

  const isConfidentialField = (key) => {
    return ['sendgridApiKey', 'cloudinaryApiSecret', 'jwtSecret', 'jwtRefreshSecret', 'cookieSecret', 'certificateSecret', 'cloudinaryApiKey', 'mongodbUri'].includes(key);
  };

  const renderField = (field) => {
    const isSecret = isConfidentialField(field.key);
    const isVisible = showSecrets[field.key];

    return (
      <div key={field.key}>
        <label className="label">{field.description}</label>
        <div className="relative">
          <input
            type={isSecret && !isVisible ? 'password' : 'text'}
            className={`input-field ${isSecret ? 'pr-10 font-mono text-sm' : ''}`}
            value={val(field.key)}
            onChange={e => setForm({ ...form, [field.key]: e.target.value })}
            placeholder={`Enter ${field.description.toLowerCase()}`}
          />
          {isSecret && (
            <button
              type="button"
              onClick={() => toggleSecret(field.key)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"
            >
              {isVisible ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderGroups = (groups) => {
    return Object.entries(groups).map(([groupName, fields]) => (
      <div key={groupName} className="card p-6">
        <h3 className="font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-primary-500 rounded-full"></span>
          {groupName}
        </h3>
        <div className="space-y-4">
          {fields.map(renderField)}
        </div>
      </div>
    ));
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage platform configuration and credentials</p>
        </div>
        <button onClick={fetchSettings} className="btn-outline flex items-center gap-2 text-sm self-start">
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-dark-100 dark:bg-dark-800 rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setMessage({ type: '', text: '' }); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-dark-700 text-dark-900 dark:text-white shadow-sm'
                : 'text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <FiRefreshCw size={24} className="animate-spin text-primary-500" />
        </div>
      ) : (
        <form onSubmit={handleSave}>
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Info banner */}
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400">
                <strong>General Settings</strong> — Control the content displayed on your Home, About, and Contact pages.
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                {renderGroups(generalGroups)}
              </div>
            </div>
          )}

          {activeTab === 'confidential' && (
            <div className="space-y-6">
              {/* Warning banner */}
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                <FiLock size={16} className="inline mr-2" />
                <strong>Confidential Settings</strong> — These are sensitive credentials. Changes will affect system operations. Handle with care.
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                {renderGroups(confidentialGroups)}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
              <FiSave size={16} /> {saving ? 'Saving...' : `Save ${activeTab === 'general' ? 'General' : 'Confidential'} Settings`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AdminSettings;
