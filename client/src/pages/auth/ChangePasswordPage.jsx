import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const ChangePasswordPage = () => {
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await changePassword(data.currentPassword, data.newPassword);
    setLoading(false);
    if (result.success) {
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50 dark:bg-dark-900 p-4">
      <div className="card p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-dark-900 dark:text-white text-center">Change Password</h2>
        <p className="text-dark-500 dark:text-dark-400 text-center mt-2">Please set a new password for your account</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          {['currentPassword', 'newPassword', 'confirmPassword'].map((field) => (
            <div key={field}>
              <label className="label">{field === 'currentPassword' ? 'Current Password' : field === 'newPassword' ? 'New Password' : 'Confirm Password'}</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
                <input
                  type={showPasswords[field] ? 'text' : 'password'}
                  {...register(field, { required: 'Required', minLength: field !== 'currentPassword' ? { value: 8, message: 'Min 8 characters' } : undefined })}
                  className="input-field pl-10 pr-10"
                  placeholder={`Enter ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
                />
                <button type="button" onClick={() => setShowPasswords((p) => ({ ...p, [field]: !p[field] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400">
                  {showPasswords[field] ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
              {errors[field] && <p className="text-red-500 text-xs mt-1">{errors[field].message}</p>}
            </div>
          ))}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
