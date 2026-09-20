import DashboardLayout from './DashboardLayout';
import { FiHome, FiUsers, FiCheckSquare, FiAward, FiBell, FiMessageSquare, FiStar, FiUser, FiEdit3 } from 'react-icons/fi';

const sidebarItems = [
  { path: 'overview', label: 'Overview', icon: <FiHome size={18} /> },
  { path: 'students', label: 'My Students', icon: <FiUsers size={18} /> },
  { path: 'tasks', label: 'Tasks', icon: <FiCheckSquare size={18} /> },
  { path: 'discussions', label: 'Discussions', icon: <FiMessageSquare size={18} /> },
  { path: 'articles', label: 'My Articles', icon: <FiEdit3 size={18} /> },
  { path: 'certificates', label: 'Certificates', icon: <FiAward size={18} /> },
  { path: 'feedback', label: 'Feedback', icon: <FiStar size={18} /> },
  { path: 'notifications', label: 'Notifications', icon: <FiBell size={18} /> },
  { path: 'profile', label: 'My Profile', icon: <FiUser size={18} /> },
];

const TrainerLayout = () => {
  return (
    <DashboardLayout
      sidebarItems={sidebarItems}
      role="trainer"
      accentColor="from-secondary-500 to-secondary-400"
    />
  );
};

export default TrainerLayout;
