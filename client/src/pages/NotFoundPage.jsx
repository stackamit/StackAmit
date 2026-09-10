import { Link } from 'react-router-dom';
import { FiHome } from 'react-icons/fi';

const NotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-dark-50 dark:bg-dark-900 p-4">
    <div className="text-center">
      <h1 className="text-8xl font-bold text-gradient">404</h1>
      <h2 className="mt-4 text-2xl font-bold text-dark-900 dark:text-white">Page Not Found</h2>
      <p className="mt-2 text-dark-500 dark:text-dark-400">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-6 btn-primary inline-flex items-center gap-2">
        <FiHome size={16} /> Go Home
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
