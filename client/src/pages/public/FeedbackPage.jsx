import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiSend, FiStar, FiMessageSquare, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const FEEDBACK_TYPES = [
  { value: 'general', label: 'General Feedback', desc: 'Share your overall experience' },
  { value: 'testimonial', label: 'Testimonial', desc: 'Share your success story' },
  { value: 'feature', label: 'Feature Request', desc: 'Suggest an improvement' },
  { value: 'bug', label: 'Bug Report', desc: 'Report an issue you found' },
  { value: 'complaint', label: 'Complaint', desc: 'Report a problem' },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const FeedbackPage = () => {
  const { isAuthenticated, user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    subject: '',
    message: '',
    rating: 5,
    type: 'general',
  });
  const [hoverRating, setHoverRating] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isAuthenticated) {
        await api.post('/feedback', {
          subject: formData.subject,
          message: formData.message,
          rating: formData.rating,
          type: formData.type,
        });
      } else {
        await axios.post(`${API_URL}/api/feedback/public`, formData);
      }
      setSubmitted(true);
      toast.success('Thank you for your feedback!');
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      toast.error(err.response?.data?.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="py-20 min-h-[60vh] flex items-center justify-center">
        <motion.div {...fadeInUp} className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiCheckCircle size={40} className="text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-dark-900 dark:text-white mb-4">Thank You!</h2>
          <p className="text-dark-500 dark:text-dark-400 text-lg mb-8">
            Your feedback has been submitted successfully. We truly appreciate your time and input.
          </p>
          <button
            onClick={() => { setSubmitted(false); setFormData({ name: user?.name || '', email: user?.email || '', subject: '', message: '', rating: 5, type: 'general' }); }}
            className="btn-outline"
          >
            Submit Another Feedback
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div {...fadeInUp} className="text-center mb-12">
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FiMessageSquare size={28} className="text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-dark-900 dark:text-white">
            Share Your Feedback
          </h1>
          <p className="mt-4 text-lg text-dark-500 dark:text-dark-400 max-w-2xl mx-auto">
            Your feedback helps us improve and grow. Whether it's a suggestion, testimonial, or issue — we'd love to hear from you.
          </p>
        </motion.div>

        {/* Form */}
        <motion.form onSubmit={handleSubmit} {...fadeInUp} transition={{ delay: 0.1 }} className="card p-8">
          {/* Feedback Type Selection */}
          <div className="mb-8">
            <label className="label mb-3">Feedback Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {FEEDBACK_TYPES.map(ft => (
                <button
                  key={ft.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: ft.value })}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    formData.type === ft.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-dark-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-600'
                  }`}
                >
                  <p className={`text-sm font-semibold ${formData.type === ft.value ? 'text-primary-600 dark:text-primary-400' : 'text-dark-700 dark:text-dark-300'}`}>
                    {ft.label}
                  </p>
                  <p className="text-xs text-dark-400 mt-1 hidden sm:block">{ft.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div className="mb-8">
            <label className="label mb-3">How would you rate your experience?</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData({ ...formData, rating: star })}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <FiStar
                    size={32}
                    className={`transition-colors ${
                      star <= (hoverRating || formData.rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-dark-300 dark:text-dark-600'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-3 text-sm text-dark-500 dark:text-dark-400">
                {formData.rating === 5 ? 'Excellent!' : formData.rating === 4 ? 'Very Good' : formData.rating === 3 ? 'Good' : formData.rating === 2 ? 'Fair' : 'Poor'}
              </span>
            </div>
          </div>

          {/* Name & Email (only for public users) */}
          {!isAuthenticated && (
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="label">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>
          )}

          {/* Show user info for authenticated users */}
          {isAuthenticated && (
            <div className="mb-6 p-4 bg-dark-50 dark:bg-dark-800/50 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-primary-300 flex items-center justify-center text-white font-semibold text-sm">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-dark-900 dark:text-white text-sm">{user?.name}</p>
                <p className="text-xs text-dark-400">{user?.email}</p>
              </div>
              <span className="ml-auto px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium capitalize">
                {user?.role}
              </span>
            </div>
          )}

          {/* Subject */}
          <div className="mb-6">
            <label className="label">Subject *</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="input-field"
              placeholder="What is your feedback about?"
              required
            />
          </div>

          {/* Message */}
          <div className="mb-6">
            <label className="label">Message *</label>
            <textarea
              rows={6}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="input-field resize-none"
              placeholder="Please share your thoughts, suggestions, or issues in detail..."
              required
            />
            <p className="text-xs text-dark-400 mt-1">{formData.message.length}/5000 characters</p>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-dark-400">
              {isAuthenticated ? 'Submitting as ' + user?.name : 'Your email will not be shared publicly.'}
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <FiSend size={16} /> Submit Feedback
                </>
              )}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
};

export default FeedbackPage;
