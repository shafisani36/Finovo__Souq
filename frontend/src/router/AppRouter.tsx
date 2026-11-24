import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoadingState } from '../components/ui/LoadingState';
import { ToastProvider } from '../components/ui/ToastProvider';
import { AuthProvider } from '../features/auth/context/AuthContext';
import { GuestRoute } from '../features/auth/guards/GuestRoute';
import { DashboardRedirect, ProtectedRoute } from '../features/auth/guards/ProtectedRoute';
import { SavedListingsProvider } from '../features/saved/SavedListingsProvider';
import { PublicLayout } from '../layouts/PublicLayout';
import { HomePage } from '../pages/public/HomePage';
import { ScrollToTop } from './ScrollToTop';

/** Loads a named page export on demand so each visit only downloads the code it needs */
function page<T extends Record<string, ComponentType>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(() => loader().then((module) => ({ default: module[name] })));
}

const DashboardLayout = page(() => import('../layouts/DashboardLayout'), 'DashboardLayout');
const BrowsePage = page(() => import('../pages/public/BrowsePage'), 'BrowsePage');
const ListingDetailPage = page(() => import('../pages/public/ListingDetailPage'), 'ListingDetailPage');
const AboutPage = page(() => import('../pages/public/AboutPage'), 'AboutPage');
const FaqPage = page(() => import('../pages/public/FaqPage'), 'FaqPage');
const ContactPage = page(() => import('../pages/public/ContactPage'), 'ContactPage');
const NotFoundPage = page(() => import('../pages/public/NotFoundPage'), 'NotFoundPage');
const LoginPage = page(() => import('../features/auth/pages/LoginPage'), 'LoginPage');
const RegisterPage = page(() => import('../features/auth/pages/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = page(() => import('../features/auth/pages/ForgotPasswordPage'), 'ForgotPasswordPage');
const AdminDashboardPage = page(() => import('../pages/admin/AdminDashboardPage'), 'AdminDashboardPage');
const ModerationPage = page(() => import('../pages/admin/ModerationPage'), 'ModerationPage');
const UsersPage = page(() => import('../pages/admin/UsersPage'), 'UsersPage');
const ReportsPage = page(() => import('../pages/admin/ReportsPage'), 'ReportsPage');
const UserDashboardPage = page(() => import('../pages/account/UserDashboardPage'), 'UserDashboardPage');
const MyListingsPage = page(() => import('../pages/account/MyListingsPage'), 'MyListingsPage');
const PostAdPage = page(() => import('../pages/account/PostAdPage'), 'PostAdPage');
const SavedPage = page(() => import('../pages/account/SavedPage'), 'SavedPage');
const MessagesPage = page(() => import('../pages/shared/MessagesPage'), 'MessagesPage');
const NotificationsPage = page(() => import('../pages/shared/NotificationsPage'), 'NotificationsPage');
const ProfilePage = page(() => import('../pages/shared/ProfilePage'), 'ProfilePage');

const guest = (element: ReactNode) => <GuestRoute>{element}</GuestRoute>;

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SavedListingsProvider>
            <ScrollToTop />
            <Suspense fallback={<LoadingState fullScreen />}>
              <Routes>
                {/* Public marketplace */}
                <Route element={<PublicLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="search" element={<BrowsePage />} />
                  <Route path="listings/:id" element={<ListingDetailPage />} />
                  <Route path="about" element={<AboutPage />} />
                  <Route path="faq" element={<FaqPage />} />
                  <Route path="contact" element={<ContactPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>

                {/* Guest-only auth */}
                <Route path="login" element={guest(<LoginPage />)} />
                <Route path="register" element={guest(<RegisterPage />)} />
                <Route path="forgot-password" element={guest(<ForgotPasswordPage />)} />

                <Route path="dashboard" element={<DashboardRedirect />} />

                {/* Admin */}
                <Route
                  path="admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<AdminDashboardPage />} />
                  <Route path="moderation" element={<ModerationPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>

                {/* Member account: buying and selling */}
                <Route
                  path="account"
                  element={
                    <ProtectedRoute allowedRoles={['user']}>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<UserDashboardPage />} />
                  <Route path="listings" element={<MyListingsPage />} />
                  <Route path="listings/new" element={<PostAdPage />} />
                  <Route path="listings/:id/edit" element={<PostAdPage />} />
                  <Route path="saved" element={<SavedPage />} />
                  <Route path="messages" element={<MessagesPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>
              </Routes>
            </Suspense>
          </SavedListingsProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
