import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';

const steps = ['Personal Info', 'Academic Details', 'Account Setup'];

const RegisterPage = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register: authRegister } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, trigger, formState: { errors } } = useForm();

  const nextStep = async () => {
    const fields = [
      ['firstName', 'lastName', 'gender', 'dob'],
      ['collegeName', 'university', 'course', 'branch', 'year'],
      ['email', 'phone', 'password', 'confirmPassword'],
    ][currentStep];

    const valid = await trigger(fields);
    if (valid) setCurrentStep((prev) => prev + 1);
  };

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await authRegister(data);
    setLoading(false);
    if (result.success) {
      // Navigate to OTP verification with email in state
      navigate('/verify-email', { state: { email: data.email } });
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-dark-900 dark:text-white text-center">Create Account</h2>
      <p className="text-dark-500 dark:text-dark-400 text-center mt-2">Register as a student</p>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mt-6 mb-8">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${i <= currentStep ? 'bg-primary-600 text-white' : 'bg-dark-100 dark:bg-dark-700 text-dark-400'}`}>
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < currentStep ? 'bg-primary-600' : 'bg-dark-200 dark:bg-dark-700'}`} />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Step 1: Personal Info */}
        {currentStep === 0 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name</label>
                <input {...register('firstName', { required: 'Required' })} className="input-field" placeholder="John" />
                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="label">Last Name</label>
                <input {...register('lastName', { required: 'Required' })} className="input-field" placeholder="Doe" />
                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
              </div>
            </div>
            <div>
              <label className="label">Gender</label>
              <select {...register('gender', { required: 'Required' })} className="input-field">
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input type="date" {...register('dob', { required: 'Required' })} className="input-field" />
            </div>
          </>
        )}

        {/* Step 2: Academic Details */}
        {currentStep === 1 && (
          <>
            <div>
              <label className="label">College Name</label>
              <input {...register('collegeName', { required: 'Required' })} className="input-field" placeholder="Your college" />
            </div>
            <div>
              <label className="label">University</label>
              <input {...register('university', { required: 'Required' })} className="input-field" placeholder="Your university" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Course</label>
                <input {...register('course', { required: 'Required' })} className="input-field" placeholder="B.Tech" />
              </div>
              <div>
                <label className="label">Branch</label>
                <input {...register('branch', { required: 'Required' })} className="input-field" placeholder="CSE" />
              </div>
            </div>
            <div>
              <label className="label">Year</label>
              <select {...register('year', { required: 'Required' })} className="input-field">
                <option value="">Select year</option>
                <option value="1st">1st Year</option>
                <option value="2nd">2nd Year</option>
                <option value="3rd">3rd Year</option>
                <option value="4th">4th Year</option>
                <option value="5th">5th Year</option>
              </select>
            </div>
          </>
        )}

        {/* Step 3: Account Setup
        {currentStep === 2 && (
          <>
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
                <input type="email" {...register('email', { required: 'Required' })} className="input-field pl-10" placeholder="you@email.com" />
              </div>
            </div>
            <div>
              <label className="label">Phone</label>
              <input {...register('phone', { required: 'Required' })} className="input-field" placeholder="+1234567890" />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
                <input type={showPassword ? 'text' : 'password'} {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} className="input-field pl-10 pr-10" placeholder="Min 8 characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400">
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input type="password" {...register('confirmPassword', { required: 'Required' })} className="input-field" placeholder="Confirm password" />
            </div>
          </>
        )} */}


        {/* Step 3: Account Setup */}
        {currentStep === 2 && (
          <>
            <div>
              <label className="label">Email</label>

              <div className="relative">
                <FiMail
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"
                  size={18}
                />

                <input
                  type="email"
                  {...register('email', { required: 'Required' })}
                  className="input-field pl-10"
                  placeholder="you@email.com"
                />
              </div>

              {errors.email && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Phone</label>

              <input
                {...register('phone', { required: 'Required' })}
                className="input-field"
                placeholder="+1234567890"
              />

              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Password</label>

              <div className="relative">
                <FiLock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"
                  size={18}
                />

                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', {
                    required: 'Required',
                    minLength: {
                      value: 8,
                      message: 'Min 8 characters',
                    },
                  })}
                  className="input-field pl-10 pr-10"
                  placeholder="Min 8 characters"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400"
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>

              {errors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Confirm Password</label>

              <input
                type="password"
                {...register('confirmPassword', { required: 'Required' })}
                className="input-field"
                placeholder="Confirm password"
              />

              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Terms and Conditions */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('acceptTerms', {
                    required: 'You must accept the Internship Terms & Conditions',
                  })}
                  className="mt-1 w-4 h-4 accent-primary-600 cursor-pointer"
                />

                <span className="text-sm text-dark-500 dark:text-dark-400 leading-relaxed">
                  I have carefully read the{' '}
                  <Link to="/terms-and-conditions" target="_blank" className="text-primary-600 hover:text-primary-700 font-semibold underline">
                    Internship Terms & Conditions
                  </Link>
                  .
                </span>
              </label>

              {errors.acceptTerms && (
                <p className="text-red-500 text-xs mt-2">
                  {errors.acceptTerms.message}
                </p>
              )}
            </div>
          </>
        )}


        {/* Navigation Buttons */}
        <div className="flex gap-3 pt-2">
          {currentStep > 0 && (
            <button type="button" onClick={() => setCurrentStep((prev) => prev - 1)} className="btn-outline flex-1 flex items-center justify-center gap-2">
              <FiArrowLeft size={16} /> Back
            </button>
          )}
          {currentStep < steps.length - 1 ? (
            <button type="button" onClick={nextStep} className="btn-primary flex-1 flex items-center justify-center gap-2">
              Next <FiArrowRight size={16} />
            </button>
          ) : (
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Create Account'}
            </button>
          )}
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-dark-500 dark:text-dark-400">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">Sign in</Link>
      </p>
    </div>
  );
};

export default RegisterPage;
