import { useState, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FiMail, FiShield, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import toast from 'react-hot-toast';

const VerifyOTPPage = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRefs = useRef([]);

  const email = location.state?.email || '';

  const handleChange = (index, value) => {
    if (value.length > 2) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }
    if (!email) {
      toast.error('Email not found. Please register again.');
      navigate('/register');
      return;
    }

    setLoading(true);
    const result = await verifyEmail(email, otpString);
    setLoading(false);

    if (result.success) {
      navigate('/login');
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error('Email not found. Please register again.');
      navigate('/register');
      return;
    }
    setResending(true);
    try {
      const { data } = await api.post('/auth/resend-otp', { email });
      toast.success(data.message || 'New OTP sent to your email');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resend OTP');
    }
    setResending(false);
  };

  if (!email) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-dark-900 dark:text-white">No Email Found</h2>
        <p className="text-dark-500 dark:text-dark-400 mt-2">Please register first to verify your email.</p>
        <Link to="/register" className="btn-primary inline-block mt-6">Go to Register</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
          <FiShield className="text-primary-600" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Verify Your Email</h2>
        <p className="text-dark-500 dark:text-dark-400 mt-2">
          We sent a 6-digit code to<br />
          <span className="font-semibold text-dark-700 dark:text-dark-200">{email}</span>
        </p>
      </div>

      <form onSubmit={handleVerify} className="mt-8 space-y-6">
        {/* OTP Inputs */}
        <div className="flex justify-center gap-3" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-xl font-bold rounded-lg border-2 border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
            />
          ))}
        </div>

        {/* Verify Button */}
        <button
          type="submit"
          disabled={loading || otp.some((d) => !d)}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <FiMail size={18} /> Verify Email
            </>
          )}
        </button>

        {/* Resend OTP */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center gap-1 mx-auto"
          >
            {resending ? (
              <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FiRefreshCw size={14} />
            )}
            {resending ? 'Sending...' : "Didn't receive the code? Resend OTP"}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-dark-500 dark:text-dark-400">
        <Link to="/register" className="text-primary-600 hover:text-primary-700 font-semibold">
          Back to Register
        </Link>
      </p>
    </div>
  );
};

export default VerifyOTPPage;
