import DashboardLayout from './DashboardLayout';
import { FiHome, FiUsers, FiUserCheck, FiBriefcase, FiSettings, FiAward, FiBell, FiGitMerge, FiFileText, FiMessageSquare, FiStar, FiUser } from 'react-icons/fi';

const sidebarItems = [
  { path: 'overview', label: 'Overview', icon: <FiHome size={18} /> },
  { path: 'profile', label: 'My Profile', icon: <FiUser size={18} /> },
  { path: 'students', label: 'Students', icon: <FiUsers size={18} /> },
  { path: 'trainers', label: 'Trainers', icon: <FiUserCheck size={18} /> },
  { path: 'internships', label: 'Internships', icon: <FiBriefcase size={18} /> },
  { path: 'certificates', label: 'Certificates', icon: <FiAward size={18} /> },
  { path: 'assignments', label: 'Assignments', icon: <FiGitMerge size={18} /> },
  { path: 'applications', label: 'Applications', icon: <FiFileText size={18} /> },
  { path: 'discussions', label: 'Discussions', icon: <FiMessageSquare size={18} /> },
  { path: 'feedback', label: 'Feedback', icon: <FiStar size={18} /> },
  { path: 'notifications', label: 'Notifications', icon: <FiBell size={18} /> },
  { path: 'settings', label: 'Settings', icon: <FiSettings size={18} /> },
];

const AdminLayout = () => {
  return (
    <DashboardLayout
      sidebarItems={sidebarItems}
      role="admin"
      accentColor="from-primary-600 to-primary-400"
    />
  );
};

export default AdminLayout;
