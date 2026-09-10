import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';

const ForgotPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { forgotPassword } = useAuth();
  const { register, handleSubmit } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await forgotPassword(data.email);
    setLoading(false);
    if (result.success) setSent(true);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-dark-900 dark:text-white text-center">Forgot Password</h2>
      <p className="text-dark-500 dark:text-dark-400 text-center mt-2">
        {sent ? 'Check your email for the OTP' : 'Enter your email to receive a reset OTP'}
      </p>

      {!sent ? (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          <div>
            <label className="label">Email Address</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
              <input type="email" {...register('email', { required: 'Email is required' })} className="input-field pl-10" placeholder="you@example.com" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
      ) : (
        <div className="mt-6 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiMail className="text-green-600" size={28} />
          </div>
          <p className="text-dark-600 dark:text-dark-300">OTP sent successfully! Check your email.</p>
        </div>
      )}

      <Link to="/login" className="mt-6 flex items-center justify-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
        <FiArrowLeft size={14} /> Back to Login
      </Link>
    </div>
  );
};

export default ForgotPasswordPage;
