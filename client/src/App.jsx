import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSelector } from 'react-redux';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './layouts/AdminLayout';
import TrainerLayout from './layouts/TrainerLayout';
import StudentLayout from './layouts/StudentLayout';

// Public Pages
import HomePage from './pages/public/HomePage';
import AboutPage from './pages/public/AboutPage';
import ContactPage from './pages/public/ContactPage';
import VerifyCertificatePage from './pages/public/VerifyCertificatePage';
import CertificateViewPage from './pages/public/CertificateViewPage';
import CertificateScannerPage from './pages/public/CertificateScannerPage';
import InternshipsPage from './pages/public/InternshipsPage';
import TermsAndConditionsPage from './pages/public/TermsAndConditionsPage';
import FeedbackPage from './pages/public/FeedbackPage';


// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyOTPPage from './pages/auth/VerifyOTPPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';

// Admin Pages
import AdminOverview from './pages/admin/AdminOverview';
import AdminStudents from './pages/admin/AdminStudents';
import AdminTrainers from './pages/admin/AdminTrainers';
import AdminInternships from './pages/admin/AdminInternships';
import AdminCertificates from './pages/admin/AdminCertificates';
import AdminAssignments from './pages/admin/AdminAssignments';
import AdminApplications from './pages/admin/AdminApplications';
import AdminDiscussion from './pages/admin/AdminDiscussion';
import AdminSettings from './pages/admin/AdminSettings';
import AdminFeedback from './pages/admin/AdminFeedback';
import AdminProfile from './pages/admin/AdminProfile';

// Trainer Pages
import TrainerOverview from './pages/trainer/TrainerOverview';
import TrainerStudents from './pages/trainer/TrainerStudents';
import TrainerTasks from './pages/trainer/TrainerTasks';
import TrainerDiscussion from './pages/trainer/TrainerDiscussion';
import TrainerCertificates from './pages/trainer/TrainerCertificates';
import TrainerProfile from './pages/trainer/TrainerProfile';

// Student Pages
import StudentOverview from './pages/student/StudentOverview';
import StudentProfile from './pages/student/StudentProfile';
import StudentInternships from './pages/student/StudentInternships';
import StudentTasks from './pages/student/StudentTasks';
import StudentApplications from './pages/student/StudentApplications';
import StudentDiscussion from './pages/student/StudentDiscussion';
import StudentCertificates from './pages/student/StudentCertificates';

// Shared Pages
import NotificationsPage from './pages/shared/NotificationsPage';

// Error Pages
import NotFoundPage from './pages/NotFoundPage';

// Protected Route Component
const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
};

function App() {
  const darkMode = useSelector((state) => state.ui.darkMode);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/verify-certificate" element={<VerifyCertificatePage />} />
          <Route path="/certificate/:id" element={<CertificateViewPage />} />
          <Route path="/scan-certificate" element={<CertificateScannerPage />} />
          <Route path="/internships" element={<InternshipsPage />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
        </Route>

        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyOTPPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Change Password (Protected) */}
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverview />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="trainers" element={<AdminTrainers />} />
          <Route path="internships" element={<AdminInternships />} />
          <Route path="certificates" element={<AdminCertificates />} />
          <Route path="assignments" element={<AdminAssignments />} />
          <Route path="applications" element={<AdminApplications />} />
          <Route path="discussions" element={<AdminDiscussion />} />
          <Route path="feedback" element={<AdminFeedback />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Trainer Routes */}
        <Route
          path="/trainer/*"
          element={
            <ProtectedRoute roles={['trainer']}>
              <TrainerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<TrainerOverview />} />
          <Route path="students" element={<TrainerStudents />} />
          <Route path="tasks" element={<TrainerTasks />} />
          <Route path="discussions" element={<TrainerDiscussion />} />
          <Route path="certificates" element={<TrainerCertificates />} />
          <Route path="profile" element={<TrainerProfile />} />
          <Route path="feedback" element={<FeedbackPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Student Routes */}
        <Route
          path="/student/*"
          element={
            <ProtectedRoute roles={['student']}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<StudentOverview />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="internships" element={<StudentInternships />} />
          <Route path="tasks" element={<StudentTasks />} />
          <Route path="applications" element={<StudentApplications />} />
          <Route path="discussions" element={<StudentDiscussion />} />
          <Route path="certificates" element={<StudentCertificates />} />
          <Route path="feedback" element={<FeedbackPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

export default App;
