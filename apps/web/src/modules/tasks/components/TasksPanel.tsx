import { CheckCircle2, Circle, ListTodo, Loader2, Lightbulb } from 'lucide-react';
import { useTasks } from '../hooks/useTasks';
import { PageLayout } from '@/shared/components/layout/PageLayout';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-muted-foreground',
};

export function TasksPanel() {
  const { tasks, loading, error, updateStatus } = useTasks();
  const pending = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const done = tasks.filter((t) => t.status === 'completed');

  const toggleComplete = async (taskId: string, current: string) => {
    await updateStatus(taskId, current === 'completed' ? 'pending' : 'completed');
  };

  return (
    <PageLayout
      title="Tasks"
      description="Action items from your captures and shared workspaces."
      sidebarTitle="How it works"
      sidebar={
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Auto-extracted
            </CardTitle>
            <CardDescription className="text-xs">
              Tasks are created when you capture task-like content.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Try: &ldquo;Task: ship the login fix by Friday&rdquo;</p>
            <p>Workspace tasks from teams you belong to appear here too.</p>
          </CardContent>
        </Card>
      }
    >
      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 mb-4">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ListTodo className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium">No tasks yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Capture something like &ldquo;Task: review the PR by Friday&rdquo; and it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 ? (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
                Open ({pending.length})
              </p>
              <div className="space-y-2">
                {pending.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggleComplete} />
                ))}
              </div>
            </section>
          ) : null}

          {done.length > 0 ? (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
                Completed ({done.length})
              </p>
              <div className="space-y-2">
                {done.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggleComplete} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </PageLayout>
  );
}

function TaskRow({
  task,
  onToggle,
}: {
  task: ReturnType<typeof useTasks>['tasks'][number];
  onToggle: (id: string, status: string) => Promise<void>;
}) {
  const isDone = task.status === 'completed';

  return (
    <Card className={cn(isDone && 'opacity-60')}>
      <CardContent className="flex items-start gap-3 p-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 h-8 w-8 mt-0.5"
          onClick={() => void onToggle(task.id, task.status)}
        >
          {isDone ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>
        <div className="min-w-0 flex-1">
          <p className={cn('font-medium text-sm', isDone && 'line-through text-muted-foreground')}>
            {task.title}
          </p>
          {task.description ? (
            <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
            <span className={PRIORITY_COLORS[task.priority] ?? ''}>{task.priority}</span>
            {task.dueAt ? <span>Due {new Date(task.dueAt).toLocaleDateString()}</span> : null}
            {task.workspaceName ? (
              <span className="rounded-full bg-muted px-2 py-0.5">{task.workspaceName}</span>
            ) : null}
            {task.assigneeName ? <span>→ {task.assigneeName}</span> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
