import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { toggleDarkMode, toggleMobileSidebar } from '../redux/slices/uiSlice';
import { useAuth } from '../hooks/useAuth';
import useNotifications from '../hooks/useNotifications';
import NotificationPanel from '../components/NotificationPanel';
import { FiSun, FiMoon, FiMenu, FiX, FiLogOut, FiBell, FiChevronDown } from 'react-icons/fi';
import { useState } from 'react';

const DashboardLayout = ({ sidebarItems, role, accentColor }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const darkMode = useSelector((state) => state.ui.darkMode);
  const mobileSidebarOpen = useSelector((state) => state.ui.mobileSidebarOpen);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount } = useNotifications();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-dark-50 dark:bg-dark-900 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-dark-800 border-r border-dark-100 dark:border-dark-700 transform transition-transform duration-200 lg:translate-x-0 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center gap-2 px-6 border-b border-dark-100 dark:border-dark-700">
            <img src="/stackamit-logo.jpg" alt="StackAmit" className="w-8 h-8 object-contain rounded-lg" />
            <span className="font-display font-bold text-lg text-dark-900 dark:text-white">
              StackAmit
            </span>
            <button onClick={() => dispatch(toggleMobileSidebar())} className="lg:hidden ml-auto p-1">
              <FiX size={20} />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-hide">
            {sidebarItems.map((item) => {
              const isActive = location.pathname === `/${role}/${item.path}`;
              return (
                <Link
                  key={item.path}
                  to={`/${role}/${item.path}`}
                  className={isActive ? 'sidebar-link-active' : 'sidebar-link'}
                  onClick={() => dispatch(toggleMobileSidebar())}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-dark-100 dark:border-dark-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-primary-500 to-primary-300 flex items-center justify-center text-white font-semibold text-sm">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark-900 dark:text-white truncate">{user?.name}</p>
                <p className="text-xs text-dark-500 dark:text-dark-400 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => dispatch(toggleMobileSidebar())} />
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-dark-800/80 backdrop-blur-lg border-b border-dark-100 dark:border-dark-700 flex items-center justify-between px-4 lg:px-8">
          <button onClick={() => dispatch(toggleMobileSidebar())} className="lg:hidden p-2 rounded-lg text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700">
            <FiMenu size={20} />
          </button>

          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => dispatch(toggleDarkMode())}
              className="p-2 rounded-lg text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
            >
              {darkMode ? <FiSun size={18} /> : <FiMoon size={18} />}
            </button>

            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 rounded-lg text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors relative"
              >
                <FiBell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <NotificationPanel role={role} isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-primary-300 flex items-center justify-center text-white font-semibold text-xs">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </div>
                <span className="hidden sm:block text-sm font-medium text-dark-700 dark:text-dark-200">{user?.name?.split(' ')[0]}</span>
                <FiChevronDown size={14} className="text-dark-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-100 dark:border-dark-700 py-1 animate-scale-in">
                  <Link
                    to={`/${role}/profile`}
                    className="block px-4 py-2 text-sm text-dark-700 dark:text-dark-200 hover:bg-dark-50 dark:hover:bg-dark-700"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <hr className="border-dark-100 dark:border-dark-700 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <FiLogOut size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
