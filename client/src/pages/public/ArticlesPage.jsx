import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  FiSearch, FiClock, FiEye, FiBookOpen, FiChevronLeft,
  FiChevronRight, FiArrowRight, FiTag, FiX,
} from 'react-icons/fi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ARTICLE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'course', label: 'Courses' },
  { value: 'tutorial', label: 'Tutorials' },
  { value: 'guide', label: 'Guides' },
  { value: 'blog', label: 'Blogs' },
  { value: 'other', label: 'Other' },
];

const typeColor = (t) => ({
  course: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  tutorial: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  guide: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  blog: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  other: 'bg-dark-100 text-dark-600 dark:bg-dark-700 dark:text-dark-400',
}[t] || 'bg-dark-100 text-dark-600 dark:bg-dark-700 dark:text-dark-400');

const getAuthorName = (a) =>
  a?.author?.name || `${a?.author?.firstName || ''} ${a?.author?.lastName || ''}`.trim() || 'Anonymous';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const ArticlesPage = () => {
  const [searchParams] = useSearchParams();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('new');
  const [tag, setTag] = useState(() => searchParams.get('tag') || '');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchArticles();
  }, [page, searchQuery, type, sort, tag]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', '12');
      if (searchQuery) params.set('search', searchQuery);
      if (type) params.set('type', type);
      if (tag) params.set('tag', tag);
      if (sort) params.set('sort', sort);

      const { data } = await axios.get(`${API_URL}/api/articles?${params.toString()}`);
      setArticles(data.data.articles || []);
      setTotal(data.data.total || 0);
      setPages(data.data.pages || 1);
    } catch (err) {
      console.error('Failed to fetch articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (t) => {
    setType(t);
    setPage(1);
  };

  const handleSortChange = (s) => {
    setSort(s);
    setPage(1);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="py-12 min-h-screen bg-dark-50 dark:bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div {...fadeInUp} className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-dark-900 dark:text-white">
            Explore Articles
          </h1>
          <p className="mt-4 text-lg text-dark-500 dark:text-dark-400 max-w-2xl mx-auto">
            Courses, tutorials, guides and blogs shared by the StackAmit community.
            {total > 0 && <span className="font-semibold text-primary-600 dark:text-primary-400"> {total} articles available.</span>}
          </p>
        </motion.div>

        {/* Search & Filter Bar */}
        <motion.div {...fadeInUp} transition={{ delay: 0.1 }} className="mb-8">
          <div className="card p-4 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search articles, courses, tutorials..."
                className="input-field pl-10 w-full"
              />
            </div>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="input-field w-full sm:w-44 cursor-pointer"
            >
              {ARTICLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="input-field w-full sm:w-44 cursor-pointer"
            >
              <option value="new">Newest First</option>
              <option value="old">Oldest First</option>
              <option value="views">Most Viewed</option>
            </select>
          </div>
        </motion.div>

        {/* Active tag filter chip */}
        {tag && !loading && (
          <div className="mb-6 flex items-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-sm font-medium">
              <FiTag size={13} /> {tag}
              <button
                onClick={() => setTag('')}
                className="ml-1 p-0.5 rounded-full hover:bg-primary-200 dark:hover:bg-primary-900/60 transition-colors"
                aria-label="Remove tag filter"
              >
                <FiX size={14} />
              </button>
            </span>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
          </div>
        ) : articles.length === 0 ? (
          <motion.div {...fadeInUp} className="text-center py-20">
            <FiBookOpen size={48} className="mx-auto text-dark-300 dark:text-dark-600 mb-4" />
            <h3 className="text-xl font-semibold text-dark-700 dark:text-dark-300">No articles found</h3>
            <p className="mt-2 text-dark-500 dark:text-dark-400">
              {searchQuery || type || tag
                ? 'Try a different search term or filter.'
                : 'No articles have been published yet. Be the first to share your knowledge!'}
            </p>
            {(searchQuery || type || tag) && (
              <button
                onClick={() => { setSearch(''); setSearchQuery(''); handleTypeChange(''); setTag(''); }}
                className="mt-4 btn-outline text-sm"
              >
                Clear Filters
              </button>
            )}
          </motion.div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article, i) => (
                <motion.div
                  key={article._id}
                  {...fadeInUp}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={`/article/${article._id}`}
                    className="card overflow-hidden flex flex-col h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
                  >
                    {/* Cover */}
                    <div className="h-40 bg-gradient-to-br from-primary-600 to-primary-400 relative flex items-center justify-center overflow-hidden">
                      {article.coverImage?.url ? (
                        <img src={article.coverImage.url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <FiBookOpen size={40} className="text-white/70" />
                      )}
                      <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${typeColor(article.type)}`}>
                        {article.type}
                      </span>
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                      {/* Title */}
                      <h3 className="text-lg font-bold text-dark-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors mb-2 line-clamp-2">
                        {article.title}
                      </h3>

                      {/* Excerpt */}
                      <p className="text-sm text-dark-500 dark:text-dark-400 mb-4 line-clamp-2 flex-1">
                        {article.excerpt || 'Read this article to learn more.'}
                      </p>

                      {/* Tags */}
                      {article.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {article.tags.slice(0, 3).map((tag, j) => (
                            <span key={j} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 rounded text-xs">
                              <FiTag size={10} /> {tag}
                            </span>
                          ))}
                          {article.tags.length > 3 && (
                            <span className="px-2 py-0.5 text-dark-400 text-xs">+{article.tags.length - 3} more</span>
                          )}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="mt-auto pt-3 border-t border-dark-100 dark:border-dark-700 flex items-center justify-between text-xs text-dark-400">
                        <div className="flex items-center gap-2 min-w-0">
                          {article.author?.avatar?.url ? (
                            <img src={article.author.avatar.url} alt={getAuthorName(article)} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center font-semibold flex-shrink-0">
                              {getAuthorName(article).charAt(0).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-dark-600 dark:text-dark-300 truncate">{getAuthorName(article)}</p>
                            <p>{formatDate(article.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {article.readTime > 0 && (
                            <span className="flex items-center gap-1"><FiClock size={12} /> {article.readTime} min</span>
                          )}
                          <span className="flex items-center gap-1"><FiEye size={12} /> {article.views || 0}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FiChevronLeft size={18} />
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      p === page
                        ? 'bg-primary-600 text-white'
                        : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="p-2 rounded-lg border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FiChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ArticlesPage;
