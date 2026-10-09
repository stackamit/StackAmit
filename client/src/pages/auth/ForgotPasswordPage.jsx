import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiArrowLeft, FiLock, FiEye, FiEyeOff, FiRefreshCw, FiShield, FiCheckCircle } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const ForgotPasswordPage = () => {
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  // 'email' -> 'otp' -> 'password' -> 'success'
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false });
  const [errors, setErrors] = useState({});

  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resetting, setResetting] = useState(false);

  const inputRefs = useRef([]);

  // ── Step 1: request OTP ──
  const handleSendOtp = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSending(true);
    const result = await forgotPassword(trimmed);
    setSending(false);
    if (result.success) setStep('otp');
  };

  // ── Step 2: resend OTP (re-request the same reset OTP) ──
  const handleResend = async () => {
    setResending(true);
    await forgotPassword(email.trim());
    setResending(false);
  };

  // ── OTP input handling ──
  const handleOtpChange = (index, value) => {
    if (value.length > 2) return;
    const digits = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);
    if (digits && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleOtpContinue = (e) => {
    e.preventDefault();
    if (otp.some((d) => !d)) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }
    setStep('password');
  };

  // ── Step 3: set new password ──
  const validatePassword = () => {
    const next = {};
    if (!PASSWORD_REGEX.test(newPassword)) {
      next.newPassword = 'Must be 8+ chars with uppercase, lowercase, number & special character';
    }
    if (newPassword !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;
    setResetting(true);
    const result = await resetPassword(email.trim(), otp.join(''), newPassword, confirmPassword);
    setResetting(false);
    if (result.success) setStep('success');
  };

  const steps = ['email', 'otp', 'password'];
  const currentStepIndex = step === 'success' ? 3 : steps.indexOf(step);

  return (
    <div>
      {/* Step indicator */}
      {step !== 'success' && (
        <div className="flex items-center justify-center gap-2 mb-8">
          {['Verify Email', 'Enter OTP', 'New Password'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    i < currentStepIndex
                      ? 'bg-green-500 text-white'
                      : i === currentStepIndex
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-100 dark:bg-dark-700 text-dark-400'
                  }`}
                >
                  {i < currentStepIndex ? <FiCheckCircle size={16} /> : i + 1}
                </div>
              </div>
              {i < 2 && <div className={`w-8 sm:w-14 h-0.5 ${i < currentStepIndex ? 'bg-green-500' : 'bg-dark-200 dark:bg-dark-700'}`} />}
            </div>
          ))}
        </div>
      )}

      {/* ─────────────── STEP 1: EMAIL ─────────────── */}
      {step === 'email' && (
        <>
          <h2 className="text-2xl font-bold text-dark-900 dark:text-white text-center">Forgot Password</h2>
          <p className="text-dark-500 dark:text-dark-400 text-center mt-2">
            Enter your email and we&apos;ll send you a reset OTP
          </p>

          <form onSubmit={handleSendOtp} className="mt-8 space-y-5">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10"
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>
            </div>
            <button type="submit" disabled={sending} className="btn-primary w-full flex items-center justify-center gap-2">
              {sending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Send OTP'
              )}
            </button>
          </form>
        </>
      )}

      {/* ─────────────── STEP 2: OTP ─────────────── */}
      {step === 'otp' && (
        <>
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
              <FiShield className="text-primary-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Check Your Email</h2>
            <p className="text-dark-500 dark:text-dark-400 mt-2">
              We sent a 6-digit code to<br />
              <span className="font-semibold text-dark-700 dark:text-dark-200">{email}</span>
            </p>
          </div>

          <form onSubmit={handleOtpContinue} className="mt-8 space-y-6">
            <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-12 h-14 text-center text-xl font-bold rounded-lg border-2 border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                />
              ))}
            </div>

            <button type="submit" disabled={otp.some((d) => !d)} className="btn-primary w-full">
              Continue
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center gap-1 mx-auto"
            >
              {resending ? <FiRefreshCw size={14} className="animate-spin" /> : <FiRefreshCw size={14} />}
              {resending ? 'Sending...' : "Didn't receive the code? Resend OTP"}
            </button>
            <button
              type="button"
              onClick={() => setStep('email')}
              className="text-xs text-dark-400 hover:text-dark-600 dark:hover:text-dark-200 mt-3"
            >
              Change email address
            </button>
          </div>
        </>
      )}

      {/* ─────────────── STEP 3: NEW PASSWORD ─────────────── */}
      {step === 'password' && (
        <>
          <h2 className="text-2xl font-bold text-dark-900 dark:text-white text-center">Set New Password</h2>
          <p className="text-dark-500 dark:text-dark-400 text-center mt-2">
            Choose a new password for <span className="font-semibold text-dark-700 dark:text-dark-200">{email}</span>
          </p>

          <form onSubmit={handleReset} className="mt-8 space-y-5">
            {[
              { key: 'new', label: 'New Password', value: newPassword, setter: setNewPassword },
              { key: 'confirm', label: 'Confirm Password', value: confirmPassword, setter: setConfirmPassword },
            ].map(({ key, label, value, setter }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
                  <input
                    type={showPasswords[key] ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="input-field pl-10 pr-10"
                    placeholder={`Enter ${label.toLowerCase()}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((p) => ({ ...p, [key]: !p[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400"
                  >
                    {showPasswords[key] ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
                {errors[key === 'new' ? 'newPassword' : 'confirmPassword'] && (
                  <p className="text-red-500 text-xs mt-1">{errors[key === 'new' ? 'newPassword' : 'confirmPassword']}</p>
                )}
              </div>
            ))}

            <p className="text-xs text-dark-400">
              Use at least 8 characters with one uppercase, one lowercase, one number and one special character.
            </p>

            <button type="submit" disabled={resetting} className="btn-primary w-full flex items-center justify-center gap-2">
              {resetting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Reset Password'
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setStep('otp')}
            className="mt-4 flex items-center justify-center gap-1.5 text-sm text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 font-medium mx-auto"
          >
            <FiArrowLeft size={14} /> Back to OTP
          </button>
        </>
      )}

      {/* ─────────────── STEP 4: SUCCESS ─────────────── */}
      {step === 'success' && (
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <FiCheckCircle className="text-green-600" size={34} />
          </div>
          <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Password Reset Successful</h2>
          <p className="text-dark-500 dark:text-dark-400 mt-2">
            A copy of your new password has been emailed to <span className="font-semibold text-dark-700 dark:text-dark-200">{email}</span>.
          </p>
          <button onClick={() => navigate('/login')} className="btn-primary w-full mt-8">
            Go to Login
          </button>
        </div>
      )}

      {step !== 'success' && (
        <Link to="/login" className="mt-6 flex items-center justify-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
          <FiArrowLeft size={14} /> Back to Login
        </Link>
      )}
    </div>
  );
};

export default ForgotPasswordPage;
