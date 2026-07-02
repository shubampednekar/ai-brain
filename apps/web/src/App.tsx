import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './modules/auth/components/AuthProvider';
import { LoginRoute } from './modules/auth/components/LoginRoute';
import { Dashboard } from './modules/auth/components/Dashboard';
import { AcceptInvitePage } from './modules/workspace/components/AcceptInvitePage';
import { AnswerEscalationPage } from './modules/workspace/components/AnswerEscalationPage';
import { NeuralBackground } from '@/shared/components/layout/NeuralBackground';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <div className="relative z-10">{children}</div>;
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <>
        <NeuralBackground />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  return (
    <>
      <NeuralBackground />
      <div className="relative z-10">
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invite"
            element={
              <ProtectedRoute>
                <AcceptInvitePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/answer"
            element={
              <ProtectedRoute>
                <AnswerEscalationPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}
