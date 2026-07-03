import { Brain, LogOut, Search, Sparkles, Users, ListTodo, Bell, Share2, Heart, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import { CapturePanel } from '@/modules/memory/components/CapturePanel';
import { SearchPanel } from '@/modules/search/components/SearchPanel';
import { WorkspacePanel } from '@/modules/workspace/components/WorkspacePanel';
import { TasksPanel } from '@/modules/tasks/components/TasksPanel';
import { RemindersPanel } from '@/modules/reminders/components/RemindersPanel';
import { PreferencesPanel } from '@/modules/preferences/components/PreferencesPanel';
import { ShoppingPanel } from '@/modules/shopping/components/ShoppingPanel';
import { GraphPanel } from '@/modules/search/components/GraphPanel';
import { EscalationInbox } from '@/modules/workspace/components/EscalationInbox';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { useState } from 'react';

type Tab = 'capture' | 'search' | 'graph' | 'tasks' | 'reminders' | 'preferences' | 'shopping' | 'shared';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('capture');

  const initials = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string).split(' ').map((n: string) => n[0]).join('')
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="relative z-10 min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
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

      <main className="mx-auto max-w-5xl px-4 py-8">
        <EscalationInbox />

        <div className="mb-8 flex flex-wrap gap-2 rounded-lg bg-muted p-1">
          <Button
            variant={tab === 'capture' ? 'default' : 'ghost'}
            className="flex-1 min-w-[5.5rem]"
            onClick={() => setTab('capture')}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Capture
          </Button>
          <Button
            variant={tab === 'search' ? 'default' : 'ghost'}
            className="flex-1 min-w-[5.5rem]"
            onClick={() => setTab('search')}
          >
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
          <Button
            variant={tab === 'graph' ? 'default' : 'ghost'}
            className="flex-1 min-w-[5.5rem]"
            onClick={() => setTab('graph')}
          >
            <Share2 className="h-4 w-4 mr-2 rotate-90" />
            Graph
          </Button>
          <Button
            variant={tab === 'tasks' ? 'default' : 'ghost'}
            className="flex-1 min-w-[5.5rem]"
            onClick={() => setTab('tasks')}
          >
            <ListTodo className="h-4 w-4 mr-2" />
            Tasks
          </Button>
          <Button
            variant={tab === 'reminders' ? 'default' : 'ghost'}
            className="flex-1 min-w-[5.5rem]"
            onClick={() => setTab('reminders')}
          >
            <Bell className="h-4 w-4 mr-2" />
            Reminders
          </Button>
          <Button
            variant={tab === 'preferences' ? 'default' : 'ghost'}
            className="flex-1 min-w-[5.5rem]"
            onClick={() => setTab('preferences')}
          >
            <Heart className="h-4 w-4 mr-2" />
            Preferences
          </Button>
          <Button
            variant={tab === 'shopping' ? 'default' : 'ghost'}
            className="flex-1 min-w-[5.5rem]"
            onClick={() => setTab('shopping')}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Shopping
          </Button>
          <Button
            variant={tab === 'shared' ? 'default' : 'ghost'}
            className="flex-1 min-w-[5.5rem]"
            onClick={() => setTab('shared')}
          >
            <Users className="h-4 w-4 mr-2" />
            Shared
          </Button>
        </div>

        {tab === 'capture' && <CapturePanel />}

        {tab === 'search' && <SearchPanel />}

        {tab === 'graph' && <GraphPanel />}

        {tab === 'tasks' && <TasksPanel />}

        {tab === 'reminders' && <RemindersPanel />}

        {tab === 'preferences' && <PreferencesPanel />}

        {tab === 'shopping' && <ShoppingPanel />}

        {tab === 'shared' && <WorkspacePanel />}
      </main>
    </div>
  );
}
