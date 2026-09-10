import { Outlet, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { toggleDarkMode } from '../redux/slices/uiSlice';
import { FiSun, FiMoon } from 'react-icons/fi';

const AuthLayout = () => {
  const darkMode = useSelector((state) => state.ui.darkMode);
  const dispatch = useDispatch();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900 p-4">
      <div className="absolute top-4 right-4">
        <button
          onClick={() => dispatch(toggleDarkMode())}
          className="p-2 rounded-lg text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
        >
          {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
        </button>
      </div>

      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <img src="/stackamit-logo.jpg" alt="StackAmit" className="w-10 h-10 object-contain rounded-xl" />
          <span className="font-display font-bold text-2xl text-dark-900 dark:text-white">
            StackAmit
          </span>
        </Link>

        <div className="card p-8">
          <Outlet />
        </div>

        <p className="text-center text-sm text-dark-500 dark:text-dark-400 mt-6">
          &copy; {new Date().getFullYear()} StackAmit. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AuthLayout;
