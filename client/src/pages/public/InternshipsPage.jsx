import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  FiSearch, FiFilter, FiClock, FiCalendar, FiUsers,
  FiCheckCircle, FiAward, FiX, FiChevronLeft, FiChevronRight,
  FiBriefcase, FiArrowRight,
} from 'react-icons/fi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CATEGORIES = [
  'Web Development', 'Mobile Development', 'Data Science',
  'Machine Learning', 'UI/UX Design', 'Digital Marketing',
  'Cloud Computing', 'Cyber Security', 'DevOps', 'Blockchain',
  'Artificial Intelligence', 'Business Analytics',
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const InternshipsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || '';

  const [internships, setInternships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const cat = searchParams.get('category') || '';
    setCategory(cat);
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    fetchInternships();
  }, [page, category, search]);

  const fetchInternships = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', '12');
      if (search) params.set('search', search);
      if (category) params.set('category', category);

      const { data } = await axios.get(`${API_URL}/api/internships/public?${params.toString()}`);
      setInternships(data.data.internships || []);
      setTotal(data.data.total || 0);
      setPages(data.data.pages || 1);
    } catch (err) {
      console.error('Failed to fetch internships:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setPage(1);
    if (cat) {
      setSearchParams({ category: cat });
    } else {
      setSearchParams({});
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchInternships();
  };

  const openDetail = async (id) => {
    try {
      const { data } = await axios.get(`${API_URL}/api/internships/public/${id}`);
      setSelectedInternship(data.data.internship);
      setShowDetail(true);
    } catch (err) {
      console.error('Failed to fetch internship detail:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="py-12 min-h-screen bg-dark-50 dark:bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div {...fadeInUp} className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-dark-900 dark:text-white">
            Explore Internships
          </h1>
          <p className="mt-4 text-lg text-dark-500 dark:text-dark-400 max-w-2xl mx-auto">
            Discover professional internship programs designed to launch your career.
            {total > 0 && <span className="font-semibold text-primary-600 dark:text-primary-400"> {total} programs available.</span>}
          </p>
        </motion.div>

        {/* Search & Filter Bar */}
        <motion.div {...fadeInUp} transition={{ delay: 0.1 }} className="mb-8">
          <div className="card p-4 flex flex-col sm:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search internships..."
                  className="input-field pl-10 w-full"
                />
              </div>
              <button type="submit" className="btn-primary px-4 py-2 flex items-center gap-2 text-sm">
                <FiSearch size={16} /> Search
              </button>
            </form>
          </div>
        </motion.div>

        {/* Category Filter Chips */}
        <motion.div {...fadeInUp} transition={{ delay: 0.15 }} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <FiFilter size={16} className="text-dark-500" />
            <span className="text-sm font-medium text-dark-600 dark:text-dark-400">Filter by category:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleCategoryChange('')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !category
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-white dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-primary-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700'
              }`}
            >
              All
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  category === cat
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-white dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-primary-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
          </div>
        ) : internships.length === 0 ? (
          <motion.div {...fadeInUp} className="text-center py-20">
            <FiBriefcase size={48} className="mx-auto text-dark-300 dark:text-dark-600 mb-4" />
            <h3 className="text-xl font-semibold text-dark-700 dark:text-dark-300">No internships found</h3>
            <p className="mt-2 text-dark-500 dark:text-dark-400">
              {category ? `No internships available in "${category}" right now.` : 'No internships available at the moment.'}
            </p>
            {category && (
              <button onClick={() => handleCategoryChange('')} className="mt-4 btn-outline text-sm">
                View All Internships
              </button>
            )}
          </motion.div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {internships.map((internship, i) => {
                const daysLeft = daysUntil(internship.deadline);
                return (
                  <motion.div
                    key={internship._id}
                    {...fadeInUp}
                    transition={{ delay: i * 0.05 }}
                    className="card p-6 flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                    onClick={() => openDetail(internship._id)}
                  >
                    {/* Category Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium">
                        {internship.category}
                      </span>
                      {daysLeft && daysLeft <= 7 && (
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-xs font-medium">
                          {daysLeft}d left
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-dark-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors mb-2">
                      {internship.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-dark-500 dark:text-dark-400 mb-4 line-clamp-2 flex-1">
                      {internship.description}
                    </p>

                    {/* Meta */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-400">
                        <FiClock size={14} className="text-dark-400" />
                        <span>{internship.duration.weeks} weeks · {internship.duration.hoursPerWeek}h/week</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-400">
                        <FiCalendar size={14} className="text-dark-400" />
                        <span>Deadline: {formatDate(internship.deadline)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-400">
                        <FiUsers size={14} className="text-dark-400" />
                        <span>{internship.seats.total - internship.seats.filled} seats available</span>
                      </div>
                    </div>

                    {/* Skills */}
                    {internship.skills && internship.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {internship.skills.slice(0, 3).map((skill, j) => (
                          <span key={j} className="px-2 py-0.5 bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 rounded text-xs">
                            {skill}
                          </span>
                        ))}
                        {internship.skills.length > 3 && (
                          <span className="px-2 py-0.5 text-dark-400 text-xs">+{internship.skills.length - 3} more</span>
                        )}
                      </div>
                    )}

                    {/* CTA */}
                    <div className="mt-auto pt-3 border-t border-dark-100 dark:border-dark-700">
                      <span className="text-primary-600 dark:text-primary-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                        View Details <FiArrowRight size={14} />
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FiChevronLeft size={18} />
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
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
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
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

      {/* Detail Modal */}
      {showDetail && selectedInternship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetail(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-dark-100 dark:border-dark-700 p-6 flex items-start justify-between z-10">
              <div>
                <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium">
                  {selectedInternship.category}
                </span>
                <h2 className="mt-3 text-2xl font-bold text-dark-900 dark:text-white">{selectedInternship.title}</h2>
              </div>
              <button onClick={() => setShowDetail(false)} className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500">
                <FiX size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Quick Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-dark-50 dark:bg-dark-900 rounded-xl">
                  <FiClock size={20} className="mx-auto text-primary-500 mb-1" />
                  <p className="text-sm font-semibold text-dark-900 dark:text-white">{selectedInternship.duration.weeks} Weeks</p>
                  <p className="text-xs text-dark-500">{selectedInternship.duration.hoursPerWeek}h/week</p>
                </div>
                <div className="text-center p-3 bg-dark-50 dark:bg-dark-900 rounded-xl">
                  <FiUsers size={20} className="mx-auto text-primary-500 mb-1" />
                  <p className="text-sm font-semibold text-dark-900 dark:text-white">{selectedInternship.seats.total - selectedInternship.seats.filled}</p>
                  <p className="text-xs text-dark-500">Seats Left</p>
                </div>
                <div className="text-center p-3 bg-dark-50 dark:bg-dark-900 rounded-xl">
                  <FiCalendar size={20} className="mx-auto text-primary-500 mb-1" />
                  <p className="text-sm font-semibold text-dark-900 dark:text-white">{formatDate(selectedInternship.deadline)}</p>
                  <p className="text-xs text-dark-500">Deadline</p>
                </div>
                <div className="text-center p-3 bg-dark-50 dark:bg-dark-900 rounded-xl">
                  <FiAward size={20} className="mx-auto text-primary-500 mb-1" />
                  <p className="text-sm font-semibold text-dark-900 dark:text-white capitalize">{selectedInternship.certificateType}</p>
                  <p className="text-xs text-dark-500">Certificate</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="font-semibold text-dark-900 dark:text-white mb-2">Description</h3>
                <p className="text-dark-600 dark:text-dark-300 text-sm leading-relaxed">{selectedInternship.description}</p>
              </div>

              {/* Skills */}
              {selectedInternship.skills && selectedInternship.skills.length > 0 && (
                <div>
                  <h3 className="font-semibold text-dark-900 dark:text-white mb-2">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedInternship.skills.map((skill, i) => (
                      <span key={i} className="px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Eligibility */}
              {selectedInternship.eligibility && (
                <div>
                  <h3 className="font-semibold text-dark-900 dark:text-white mb-2">Eligibility</h3>
                  <p className="text-dark-600 dark:text-dark-300 text-sm">{selectedInternship.eligibility}</p>
                </div>
              )}

              {/* Learning Outcomes */}
              {selectedInternship.learningOutcomes && selectedInternship.learningOutcomes.length > 0 && (
                <div>
                  <h3 className="font-semibold text-dark-900 dark:text-white mb-2">What You'll Learn</h3>
                  <ul className="space-y-2">
                    {selectedInternship.learningOutcomes.map((outcome, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-dark-600 dark:text-dark-300">
                        <FiCheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Requirements */}
              {selectedInternship.requirements && selectedInternship.requirements.length > 0 && (
                <div>
                  <h3 className="font-semibold text-dark-900 dark:text-white mb-2">Requirements</h3>
                  <ul className="space-y-2">
                    {selectedInternship.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-dark-600 dark:text-dark-300">
                        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Assigned Trainer */}
              {selectedInternship.assignedTrainer && (
                <div>
                  <h3 className="font-semibold text-dark-900 dark:text-white mb-2">Assigned Trainer</h3>
                  <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-900 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-primary-300 flex items-center justify-center text-white font-semibold text-sm">
                      {selectedInternship.assignedTrainer.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-dark-900 dark:text-white">{selectedInternship.assignedTrainer.name}</p>
                      {selectedInternship.assignedTrainer.expertise && (
                        <p className="text-xs text-dark-500">{selectedInternship.assignedTrainer.expertise.join(', ')}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="flex gap-3 pt-4 border-t border-dark-100 dark:border-dark-700">
                <Link to="/register" className="btn-primary flex-1 text-center py-3 flex items-center justify-center gap-2">
                  Apply Now <FiArrowRight />
                </Link>
                <button onClick={() => setShowDetail(false)} className="btn-outline py-3 px-6">
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default InternshipsPage;
