import { cn } from '@/shared/lib/utils';
import type { TaskItem } from '../hooks/useTasks';

const TONE_STYLES = {
  action: 'bg-primary/15 text-primary border-primary/25',
  waiting: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  neutral: 'bg-muted text-muted-foreground border-border',
} as const;

interface TaskRoleBadgeProps {
  task: TaskItem;
  className?: string;
}

export function TaskRoleBadge({ task, className }: TaskRoleBadgeProps) {
  if (!task.roleLabel) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight',
        TONE_STYLES[task.roleTone ?? 'neutral'],
        className,
      )}
    >
      {task.roleLabel}
    </span>
  );
}
