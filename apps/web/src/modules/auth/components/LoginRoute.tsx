import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { LoginPage } from './LoginPage';

export function LoginRoute() {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) return <Navigate to={redirect} replace />;
  return <LoginPage redirect={redirect} />;
}
