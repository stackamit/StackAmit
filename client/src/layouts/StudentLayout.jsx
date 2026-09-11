import DashboardLayout from './DashboardLayout';
import { FiHome, FiUser, FiBriefcase, FiCheckSquare, FiAward, FiBell, FiFileText, FiMessageSquare, FiStar, FiMail } from 'react-icons/fi';

const sidebarItems = [
  { path: 'overview', label: 'Overview', icon: <FiHome size={18} /> },
  { path: 'profile', label: 'My Profile', icon: <FiUser size={18} /> },
  { path: 'internships', label: 'Internships', icon: <FiBriefcase size={18} /> },
  { path: 'tasks', label: 'My Tasks', icon: <FiCheckSquare size={18} /> },
  { path: 'applications', label: 'My Applications', icon: <FiFileText size={18} /> },
  { path: 'offer-letters', label: 'Offer Letters', icon: <FiMail size={18} /> },
  { path: 'discussions', label: 'Discussion', icon: <FiMessageSquare size={18} /> },
  { path: 'certificates', label: 'Certificates', icon: <FiAward size={18} /> },
  { path: 'feedback', label: 'Feedback', icon: <FiStar size={18} /> },
  { path: 'notifications', label: 'Notifications', icon: <FiBell size={18} /> },
];

const StudentLayout = () => {
  return (
    <DashboardLayout
      sidebarItems={sidebarItems}
      role="student"
      accentColor="from-purple-500 to-purple-400"
    />
  );
};

export default StudentLayout;
