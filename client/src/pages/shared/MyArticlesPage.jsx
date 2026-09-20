import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../services/api';
import {
  FiPlus, FiEdit3, FiEye, FiTrash2, FiUpload, FiEyeOff,
  FiBookOpen, FiFileText, FiClock, FiTrendingUp,
} from 'react-icons/fi';

const typeColor = (t) => ({
  course: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  tutorial: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  guide: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  blog: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  other: 'bg-dark-100 text-dark-600 dark:bg-dark-700 dark:text-dark-400',
}[t] || 'bg-dark-100 text-dark-600 dark:bg-dark-700 dark:text-dark-400');

const statusColor = (s) => s === 'published'
  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';

const MyArticlesPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/articles/my');
      setArticles(data.data.articles || []);
    } catch (err) {
      console.error('Failed to fetch articles:', err);
      toast.error(err?.response?.data?.message || 'Failed to load your articles');
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async (article) => {
    if (busyId) return;
    const newStatus = article.status === 'published' ? 'draft' : 'published';
    setBusyId(article._id);
    try {
      const { data } = await api.patch(`/articles/${article._id}/status`, { status: newStatus });
      setArticles((prev) =>
        prev.map((a) => (a._id === article._id ? { ...a, status: newStatus } : a))
      );
      toast.success(data.message || (newStatus === 'published' ? 'Article published' : 'Article unpublished'));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (article) => {
    if (busyId) return;
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
    setBusyId(article._id);
    try {
      const { data } = await api.delete(`/articles/${article._id}`);
      setArticles((prev) => prev.filter((a) => a._id !== article._id));
      toast.success(data.message || 'Article deleted');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete article');
    } finally {
      setBusyId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Stats
  const published = articles.filter((a) => a.status === 'published').length;
  const drafts = articles.length - published;
  const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0);

  const stats = [
    { label: 'Total Articles', value: articles.length, icon: <FiBookOpen size={20} />, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-100 dark:bg-primary-900/30' },
    { label: 'Published', value: published, icon: <FiEye size={20} />, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
    { label: 'Drafts', value: drafts, icon: <FiFileText size={20} />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { label: 'Total Views', value: totalViews, icon: <FiTrendingUp size={20} />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">My Articles</h1>
          <p className="mt-1 text-dark-500 dark:text-dark-400">
            Create and manage courses, tutorials, guides and blogs you share publicly.
          </p>
        </div>
        {/* Relative link: works from /student, /trainer and /admin dashboards */}
        <Link to="new" className="btn-primary inline-flex items-center gap-2 text-sm self-start sm:self-auto">
          <FiPlus size={16} /> Write New Article
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-4 sm:p-5"
          >
            <div className="flex items-center gap-3">
              <span className={`p-2.5 rounded-lg ${s.bg} ${s.color}`}>{s.icon}</span>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-dark-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-dark-500 dark:text-dark-400">{s.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="card p-10 flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent"></div>
        </div>
      ) : articles.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-10 text-center">
          <FiEdit3 size={40} className="mx-auto text-dark-300 dark:text-dark-600 mb-3" />
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">No articles yet</h3>
          <p className="mt-1 text-dark-500 dark:text-dark-400">
            Share your knowledge with the community — write your first article.
          </p>
          <Link to="new" className="mt-5 inline-flex items-center gap-2 btn-primary text-sm">
            <FiPlus size={16} /> Write New Article
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {articles.map((article, i) => (
            <motion.div
              key={article._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card p-4 sm:p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${typeColor(article.type)}`}>
                      {article.type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor(article.status)}`}>
                      {article.status}
                    </span>
                    {article.category && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400">
                        {article.category}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-dark-900 dark:text-white truncate">{article.title}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dark-500 dark:text-dark-400">
                    <span>{formatDate(article.createdAt)}</span>
                    <span className="flex items-center gap-1"><FiEye size={12} /> {article.views || 0} views</span>
                    {article.readTime > 0 && (
                      <span className="flex items-center gap-1"><FiClock size={12} /> {article.readTime} min</span>
                    )}
                    {article.tags?.length > 0 && (
                      <span className="truncate max-w-[200px]">#{article.tags.join(' #')}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {article.status === 'published' && (
                    <Link
                      to={`/article/${article._id}`}
                      title="View public page"
                      className="p-2 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <FiEye size={18} />
                    </Link>
                  )}
                  <Link
                    to={`edit/${article._id}`}
                    title="Edit article"
                    className="p-2 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    <FiEdit3 size={18} />
                  </Link>
                  <button
                    onClick={() => togglePublish(article)}
                    disabled={busyId === article._id}
                    title={article.status === 'published' ? 'Unpublish (move to draft)' : 'Publish article'}
                    className="p-2 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800 hover:text-green-600 dark:hover:text-green-400 disabled:opacity-50 transition-colors"
                  >
                    {busyId === article._id ? (
                      <span className="flex justify-center">
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></span>
                      </span>
                    ) : article.status === 'published' ? (
                      <FiEyeOff size={18} />
                    ) : (
                      <FiUpload size={18} />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(article)}
                    disabled={busyId === article._id}
                    title="Delete article"
                    className="p-2 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyArticlesPage;
