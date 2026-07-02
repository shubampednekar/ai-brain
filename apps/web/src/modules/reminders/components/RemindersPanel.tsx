import { Bell, BellOff, Clock, Lightbulb, Loader2 } from 'lucide-react';
import { useReminders } from '../hooks/useReminders';
import { PageLayout } from '@/shared/components/layout/PageLayout';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

export function RemindersPanel() {
  const { reminders, loading, error, cancel, snooze } = useReminders();

  const scheduled = reminders.filter((r) => r.status === 'scheduled');
  const past = reminders.filter((r) => r.status === 'sent' || r.status === 'failed');
  const cancelled = reminders.filter((r) => r.status === 'cancelled');

  return (
    <PageLayout
      title="Reminders"
      description="Time-based reminders detected from your captures. You'll get an email when they're due."
      sidebarTitle="How it works"
      sidebar={
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Auto-detected
            </CardTitle>
            <CardDescription className="text-xs">
              Reminders are parsed from natural language captures.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Try: &ldquo;Remind me to call the client tomorrow at 10am&rdquo;</p>
            <p>Snooze or cancel anytime before the due time.</p>
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
      ) : reminders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium">No reminders yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Capture something like &ldquo;Remind me to call John tomorrow at 9am&rdquo; and it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {scheduled.length > 0 ? (
            <ReminderSection title={`Upcoming (${scheduled.length})`} items={scheduled} onCancel={cancel} onSnooze={snooze} />
          ) : null}
          {past.length > 0 ? (
            <ReminderSection title="Past" items={past} />
          ) : null}
          {cancelled.length > 0 ? (
            <ReminderSection title="Cancelled" items={cancelled} />
          ) : null}
        </div>
      )}
    </PageLayout>
  );
}

function ReminderSection({
  title,
  items,
  onCancel,
  onSnooze,
}: {
  title: string;
  items: ReturnType<typeof useReminders>['reminders'];
  onCancel?: (id: string) => Promise<void>;
  onSnooze?: (id: string, hours: number) => Promise<void>;
}) {
  return (
    <section>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
        {title}
      </p>
      <div className="space-y-2">
        {items.map((reminder) => (
          <Card key={reminder.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{reminder.title}</p>
                  {reminder.description ? (
                    <p className="text-xs text-muted-foreground mt-1">{reminder.description}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(reminder.scheduledAt).toLocaleString()}
                    <span className="capitalize ml-2">{reminder.status}</span>
                  </p>
                </div>
                {onCancel && onSnooze && reminder.status === 'scheduled' ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void onSnooze(reminder.id, 1)}
                    >
                      +1h
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void onCancel(reminder.id)}
                    >
                      <BellOff className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
