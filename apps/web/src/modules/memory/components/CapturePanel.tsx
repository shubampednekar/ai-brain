import { Lightbulb, Sparkles } from 'lucide-react';
import { MemoryCapture } from '@/modules/memory/components/MemoryCapture';
import { MemoryFeed } from '@/modules/memory/components/MemoryFeed';
import { PageLayout } from '@/shared/components/layout/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

const TIPS = [
  'Type naturally — no folders or tags needed.',
  'Press ⌘+Enter (Ctrl+Enter) to capture quickly.',
  'AI detects intent: reminders, tasks, shopping lists, preferences, and more.',
];

export function CapturePanel() {
  return (
    <PageLayout
      title="Capture"
      description="Save thoughts, tasks, and knowledge in natural language. AI organizes everything for you."
      sidebarTitle="Tips"
      sidebar={
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Quick tips
            </CardTitle>
            <CardDescription className="text-xs">
              Get the most out of memory capture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2.5">
              {TIPS.map((tip) => (
                <li key={tip} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      }
    >
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            New memory
          </CardTitle>
          <CardDescription>
            What would you like to remember?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemoryCapture />
        </CardContent>
      </Card>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
          Recent memories
        </p>
        <MemoryFeed />
      </div>
    </PageLayout>
  );
}
