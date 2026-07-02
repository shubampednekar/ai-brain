import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent } from '@/shared/components/ui/card';

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { acceptInvitation } = useWorkspaces();
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      const workspace = await acceptInvitation(token.trim());
      setSuccess(`You joined "${workspace.name}"!`);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <h1 className="text-xl font-semibold">Accept workspace invitation</h1>
          <p className="text-sm text-muted-foreground">
            Paste the invitation token from your email to join a shared workspace.
          </p>

          <form onSubmit={handleAccept} className="space-y-3">
            <Input
              placeholder="Invitation token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={!token.trim() || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Join workspace
            </Button>
          </form>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {success}
            </div>
          )}

          <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
            Back to dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
