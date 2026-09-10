import { Outlet, Link } from 'react-router-dom';
import { useState } from 'react';
import { HiMenu, HiX } from 'react-icons/hi';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { toggleDarkMode } from '../redux/slices/uiSlice';
import useSiteSettings from '../hooks/useSiteSettings';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const darkMode = useSelector((state) => state.ui.darkMode);
  const dispatch = useDispatch();
  const { settings } = useSiteSettings();
  const companyName = settings.companyName || 'StackAmit';

  return (
    <nav className="fixed top-0 w-full bg-white/80 dark:bg-dark-900/80 backdrop-blur-lg border-b border-dark-100 dark:border-dark-800 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src="/stackamit-logo.jpg" alt="StackAmit" className="w-8 h-8 object-contain rounded-lg" />
            <span className="font-display font-bold text-xl text-dark-900 dark:text-white">
              {companyName}
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-dark-600 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors">Home</Link>
            <Link to="/internships" className="text-dark-600 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors">Internships</Link>
            <Link to="/about" className="text-dark-600 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors">About</Link>
            <Link to="/contact" className="text-dark-600 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors">Contact</Link>
            <Link to="/feedback" className="text-dark-600 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors">Feedback</Link>
            <Link to="/verify-certificate" className="text-dark-600 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors">Verify Certificate</Link>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => dispatch(toggleDarkMode())}
              className="p-2 rounded-lg text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
            >
              {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
            </button>
            <Link to="/login" className="btn-ghost text-sm">Login</Link>
            <Link to="/register" className="btn-primary text-sm py-2 px-4">Get Started</Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-dark-600 dark:text-dark-300"
          >
            {mobileMenuOpen ? <HiX size={24} /> : <HiMenu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-dark-900 border-t border-dark-100 dark:border-dark-800 animate-slide-down">
          <div className="px-4 py-4 space-y-3">
            <Link to="/" className="block py-2 text-dark-600 dark:text-dark-300 font-medium" onClick={() => setMobileMenuOpen(false)}>Home</Link>
            <Link to="/internships" className="block py-2 text-dark-600 dark:text-dark-300 font-medium" onClick={() => setMobileMenuOpen(false)}>Internships</Link>
            <Link to="/about" className="block py-2 text-dark-600 dark:text-dark-300 font-medium" onClick={() => setMobileMenuOpen(false)}>About</Link>
            <Link to="/contact" className="block py-2 text-dark-600 dark:text-dark-300 font-medium" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
            <Link to="/feedback" className="block py-2 text-dark-600 dark:text-dark-300 font-medium" onClick={() => setMobileMenuOpen(false)}>Feedback</Link>
            <Link to="/verify-certificate" className="block py-2 text-dark-600 dark:text-dark-300 font-medium" onClick={() => setMobileMenuOpen(false)}>Verify Certificate</Link>
            <hr className="border-dark-100 dark:border-dark-700" />
            <Link to="/login" className="block py-2 text-primary-600 font-medium" onClick={() => setMobileMenuOpen(false)}>Login</Link>
            <Link to="/register" className="block btn-primary text-center text-sm" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
          </div>
        </div>
      )}
    </nav>
  );
};

const Footer = () => {
  const { settings } = useSiteSettings();
  const companyName = settings.companyName || 'StackAmit';
  const footerEmail = settings.contactEmail || settings.companyEmail || 'info@stackamit.com';
  const footerPhone = settings.contactPhone || settings.companyPhone || '+1 (555) 123-4567';

  return (
  <footer className="bg-dark-900 text-dark-300">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <img src="/stackamit-logo.jpg" alt="StackAmit" className="w-8 h-8 object-contain rounded-lg" />
            <span className="font-display font-bold text-xl text-white">{companyName}</span>
          </div>
          <p className="text-sm text-dark-400">Empowering the next generation of professionals through world-class internship programs.</p>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-4">Quick Links</h4>
          <div className="space-y-2 text-sm">
            <Link to="/" className="block hover:text-primary-400 transition-colors">Home</Link>
            <Link to="/about" className="block hover:text-primary-400 transition-colors">About Us</Link>
            <Link to="/contact" className="block hover:text-primary-400 transition-colors">Contact</Link>
            <Link to="/feedback" className="block hover:text-primary-400 transition-colors">Feedback</Link>
            <Link to="/verify-certificate" className="block hover:text-primary-400 transition-colors">Verify Certificate</Link>
            <Link to="/terms-and-conditions" className="block hover:text-primary-400 transition-colors">Terms and Conditions</Link>
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-4">Programs</h4>
          <div className="space-y-2 text-sm">
            <Link to="/internships?category=Web Development" className="block hover:text-primary-400 transition-colors">Web Development</Link>
            <Link to="/internships?category=Data Science" className="block hover:text-primary-400 transition-colors">Data Science</Link>
            <Link to="/internships?category=UI/UX Design" className="block hover:text-primary-400 transition-colors">UI/UX Design</Link>
            <Link to="/internships?category=Digital Marketing" className="block hover:text-primary-400 transition-colors">Digital Marketing</Link>
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-4">Contact</h4>
          
          <div className="space-y-2 text-sm">
            <p>{footerEmail}</p>
            <p>{footerPhone}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-dark-800 mt-8 pt-8 text-center text-sm text-dark-500">
        <p>&copy; {new Date().getFullYear()} {companyName}. All rights reserved.</p>
      </div>
    </div>
  </footer>
  );
};

const PublicLayout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
