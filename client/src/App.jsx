import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import Toast from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import ScrollToTop from './components/common/ScrollToTop';

// Immediate zero-delay homepage import
import Home from './pages/Home';

// High-speed lazy imports with instant idle prefetch
const listingsImport = () => import('./pages/Listings');
const propertyDetailImport = () => import('./pages/PropertyDetail');
const aboutUsImport = () => import('./pages/AboutUs');
const contactUsImport = () => import('./pages/ContactUs');
const loginImport = () => import('./pages/auth/Login');
const registerImport = () => import('./pages/auth/Register');

const Listings = lazy(listingsImport);
const PropertyDetail = lazy(propertyDetailImport);
const ComparePage = lazy(() => import('./pages/ComparePage'));
const AboutUs = lazy(aboutUsImport);
const ContactUs = lazy(contactUsImport);
const Login = lazy(loginImport);
const Register = lazy(registerImport);
const AdminLogin = lazy(() => import('./pages/auth/AdminLogin'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));

// Dashboards & Profiles
const BuyerDashboard = lazy(() => import('./pages/dashboard/BuyerDashboard'));
const BuyerProfile = lazy(() => import('./pages/dashboard/BuyerProfile'));
const BuilderDashboard = lazy(() => import('./pages/dashboard/BuilderDashboard'));
const BuilderProfile = lazy(() => import('./pages/dashboard/BuilderProfile'));
const OwnerDashboard = lazy(() => import('./pages/dashboard/OwnerDashboard'));
const OwnerProfile = lazy(() => import('./pages/dashboard/OwnerProfile'));
const AgentDashboard = lazy(() => import('./pages/dashboard/AgentDashboard'));
const AgentProfile = lazy(() => import('./pages/dashboard/AgentProfile'));
const AdminDashboard = lazy(() => import('./pages/dashboard/AdminDashboard'));

// Prefetch critical chunks during browser idle time for 0ms transitions
if (typeof window !== 'undefined') {
  const prefetchChunks = () => {
    listingsImport();
    propertyDetailImport();
    loginImport();
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(prefetchChunks, { timeout: 2000 });
  } else {
    setTimeout(prefetchChunks, 1500);
  }
}

const PageLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
    <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    <div className="text-xs text-slate-500 font-medium mt-3">Loading EstateXplorer...</div>
  </div>
);

// Role-based dashboard router
const DashboardRouter = ({ requireAdmin = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!user) {
    if (requireAdmin) {
      return <Navigate to="/admin-portal/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }
  const activeRole = user.role || 'buyer';

  if (requireAdmin && activeRole !== 'admin' && !user.roles?.includes('admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  // If requireAdmin or active role is admin, render AdminDashboard
  if (requireAdmin || activeRole === 'admin') return <AdminDashboard />;

  // If URL contains a specific role segment, validate it matches the user's active role
  const pathLower = location.pathname.toLowerCase();
  const pathRole = pathLower.includes('/builder') ? 'builder'
    : pathLower.includes('/agent') ? 'agent'
    : pathLower.includes('/owner') ? 'owner'
    : pathLower.includes('/buyer') ? 'buyer'
    : null;

  if (pathRole && pathRole !== activeRole) {
    // User is at the wrong role URL — redirect to their canonical dashboard
    return <Navigate to="/dashboard" replace />;
  }

  if (activeRole === 'builder') return <BuilderDashboard />;
  if (activeRole === 'agent') return <AgentDashboard />;
  if (activeRole === 'owner') return <OwnerDashboard />;
  // Default: buyer dashboard
  return <BuyerDashboard />;
};

// Role-based profile router
const ProfileRouter = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const activeRole = user.role || 'buyer';

  if (activeRole === 'admin') return <BuyerProfile />;
  if (activeRole === 'builder') return <BuilderProfile />;
  if (activeRole === 'agent') return <AgentProfile />;
  if (activeRole === 'owner') return <OwnerProfile />;
  // Default: buyer profile
  return <BuyerProfile />;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <Toast />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/contact" element={<ContactUs />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin-portal/login" element={<AdminLogin />} />
              <Route path="/dashboard" element={<DashboardRouter />} />
              <Route path="/dashboard/builder" element={<DashboardRouter />} />
              <Route path="/dashboard/buyer" element={<DashboardRouter />} />
              <Route path="/dashboard/agent" element={<DashboardRouter />} />
              <Route path="/dashboard/owner" element={<DashboardRouter />} />
              <Route path="/admin" element={<DashboardRouter requireAdmin={true} />} />
              <Route path="/dashboard/profile" element={<ProfileRouter />} />
              <Route path="/listings" element={<Listings />} />
              <Route path="/projects" element={<Listings projectOnly={true} />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/property/:id" element={<PropertyDetail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
