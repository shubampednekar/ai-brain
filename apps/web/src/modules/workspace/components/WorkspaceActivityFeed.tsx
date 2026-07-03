import { Link } from 'react-router-dom';
import {
  Activity,
  HelpCircle,
  ListTodo,
  Loader2,
  MessageSquarePlus,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import { useWorkspaceActivity } from '../hooks/useWorkspaceActivity';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { formatDistanceToNow } from '@/modules/memory/utils/date';
import { cn } from '@/shared/lib/utils';

const ACTIVITY_ICONS = {
  memory_captured: MessageSquarePlus,
  task_created: ListTodo,
  question_escalated: HelpCircle,
  question_resolved: HelpCircle,
  member_joined: UserPlus,
  invitation_sent: UserPlus,
} as const;

const ACTIVITY_LABELS = {
  memory_captured: 'captured a memory',
  task_created: 'created a task',
  question_escalated: 'asked a question (needs help)',
  question_resolved: 'got a question answered',
  member_joined: 'joined',
  invitation_sent: 'sent an invitation',
} as const;

interface WorkspaceActivityFeedProps {
  workspaceId: string;
}

export function WorkspaceActivityFeed({ workspaceId }: WorkspaceActivityFeedProps) {
  const { user } = useAuth();
  const { activity, loading, error } = useWorkspaceActivity(workspaceId);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive px-1">{error}</p>
    );
  }

  if (activity.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No activity yet. Capture a shared memory or ask a question to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {activity.map((item) => {
        const Icon = ACTIVITY_ICONS[item.type] ?? Activity;
        const label = ACTIVITY_LABELS[item.type] ?? 'activity';
        const isEscalation = item.type === 'question_escalated';
        const escalationId = item.metadata?.escalationId as string | undefined;
        const targetUserId = item.metadata?.targetUserId as string | undefined;
        const canAnswer = isEscalation && escalationId && targetUserId === user?.id;

        return (
          <Card
            key={item.id}
            className={cn(isEscalation && 'border-amber-500/20 bg-amber-500/5')}
          >
            <CardContent className="flex items-start gap-3 p-3">
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{item.actorName}</span>{' '}
                  <span className="text-muted-foreground">{label}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground/70">
                    {formatDistanceToNow(item.createdAt)}
                  </p>
                  {canAnswer ? (
                    <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs text-primary">
                      <Link to={`/answer?escalation=${encodeURIComponent(escalationId)}`}>
                        Answer this question
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
