import { createContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { clearApiCache } from '../services/apiCache';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // SA-020: restore the session cookie-first. The access token now also lives
  // in an httpOnly cookie (path '/'), so a reload can re-authenticate via
  // GET /auth/me without depending on the localStorage copy. localStorage is
  // kept only as a fast path / offline fallback until every call site is
  // migrated, so existing logins are unaffected.
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');

    const applyLocal = () => {
      if (storedUser && token) {
        try {
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
          return true;
        } catch {
          localStorage.removeItem('user');
          localStorage.removeItem('accessToken');
        }
      }
      return false;
    };

    if (applyLocal()) {
      setLoading(false);
      return;
    }

    // No usable localStorage session - try the httpOnly cookie. This is a
    // passive restore probe: a 401 here means "not logged in", NOT "redirect".
    // _noRedirect stops the shared interceptor from bouncing an anonymous
    // visitor off a public page, while still allowing a legitimate refresh
    // (valid refresh cookie + expired access) to restore the session.
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/auth/me', { _noRedirect: true });
        const me = data?.data?.user;
        if (!cancelled && me && me._id) {
          setUser(me);
          setIsAuthenticated(true);
          localStorage.setItem('user', JSON.stringify(me));
        }
      } catch {
        // Cookie absent/invalid: fully anonymous. Clear any stale residue.
        if (!cancelled) {
          localStorage.removeItem('user');
          localStorage.removeItem('accessToken');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const { user: userData, accessToken, mustChangePassword } = data.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setIsAuthenticated(true);

      return { success: true, mustChangePassword, role: userData.role };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const register = async (formData) => {
    try {
      const { data } = await api.post('/auth/register', formData);
      toast.success(data.message);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      return { success: false, message, errors: error.response?.data?.errors };
    }
  };

  const verifyEmail = async (email, otp) => {
    try {
      const { data } = await api.post('/auth/verify-email', { email, otp });
      toast.success(data.message);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Verification failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
    // SA-020: drop cached API payloads (per-user PII: students, trainers,
    // certificates, etc.) so a shared device does not retain them after logout.
    // Must run BEFORE removing 'user' - clearApiCache() resolves the owner from
    // localStorage.user; otherwise it would clear the wrong (anon) bucket and
    // leave this user's cached data behind.
    clearApiCache();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    toast.success('Logged out successfully');
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success(data.message);
      if (user) {
        const updatedUser = { ...user, mustChangePassword: false };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Password change failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      toast.success(data.message);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Request failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const resetPassword = async (email, otp, newPassword, confirmPassword) => {
    try {
      const { data } = await api.post('/auth/reset-password', { email, otp, newPassword, confirmPassword });
      toast.success(data.message);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Reset failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    setUser: updateUser,
    loading,
    isAuthenticated,
    login,
    register,
    verifyEmail,
    logout,
    changePassword,
    forgotPassword,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
