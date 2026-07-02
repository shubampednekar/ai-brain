import { Brain, LogOut, Search, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import { MemoryCapture } from '@/modules/memory/components/MemoryCapture';
import { MemoryFeed } from '@/modules/memory/components/MemoryFeed';
import { SearchPanel } from '@/modules/search/components/SearchPanel';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { useState } from 'react';

type Tab = 'capture' | 'search' | 'shared';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('capture');

  const initials = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string).split(' ').map((n: string) => n[0]).join('')
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">AI Brain</span>
          </div>
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.user_metadata?.avatar_url as string} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 flex gap-2 rounded-lg bg-muted p-1">
          <Button
            variant={tab === 'capture' ? 'default' : 'ghost'}
            className="flex-1"
            onClick={() => setTab('capture')}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Capture
          </Button>
          <Button
            variant={tab === 'search' ? 'default' : 'ghost'}
            className="flex-1"
            onClick={() => setTab('search')}
          >
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
          <Button
            variant={tab === 'shared' ? 'default' : 'ghost'}
            className="flex-1"
            onClick={() => setTab('shared')}
          >
            <Users className="h-4 w-4 mr-2" />
            Shared
          </Button>
        </div>

        {tab === 'capture' && (
          <div className="space-y-8">
            <MemoryCapture />
            <div>
              <h2 className="mb-4 text-lg font-medium">Recent Memories</h2>
              <MemoryFeed />
            </div>
          </div>
        )}

        {tab === 'search' && (
          <div>
            <h2 className="mb-4 text-lg font-medium">AI Search</h2>
            <SearchPanel />
          </div>
        )}

        {tab === 'shared' && (
          <div className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="font-medium">Shared Workspaces</p>
            <p className="text-sm mt-2">Invite collaborators and build shared memory together.</p>
            <p className="text-xs mt-4 text-muted-foreground">Coming soon in your workspace setup.</p>
          </div>
        )}
      </main>
    </div>
  );
}
