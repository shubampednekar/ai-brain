import { Circle, ListTodo, Loader2 } from 'lucide-react';
import { useTasks } from '@/modules/tasks/hooks/useTasks';
import { TaskRoleBadge } from '@/modules/tasks/components/TaskRoleBadge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

interface WorkspaceTasksProps {
  workspaceId: string;
}

export function WorkspaceTasks({ workspaceId }: WorkspaceTasksProps) {
  const { tasks, loading, error, updateStatus } = useTasks(workspaceId);
  const open = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || open.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1 flex items-center gap-1.5">
        <ListTodo className="h-3.5 w-3.5" />
        Workspace tasks ({open.length})
      </p>
      <div className="space-y-2">
        {open.slice(0, 5).map((task) => (
          <Card
            key={task.id}
            className={cn(task.roleTone === 'action' && 'border-primary/25 bg-primary/5')}
          >
            <CardContent className="flex items-center gap-3 p-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 h-7 w-7"
                onClick={() => void updateStatus(task.id, 'completed')}
              >
                <Circle className="h-4 w-4 text-muted-foreground" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="mb-1">
                  <TaskRoleBadge task={task} />
                </div>
                <p className="text-sm font-medium truncate">{task.title}</p>
              </div>
              {task.priority !== 'medium' ? (
                <span className={cn('text-xs capitalize shrink-0', task.priority === 'urgent' ? 'text-red-400' : 'text-muted-foreground')}>
                  {task.priority}
                </span>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
