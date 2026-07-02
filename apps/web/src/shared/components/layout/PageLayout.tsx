import type { ReactNode } from 'react';

interface PageLayoutProps {
  title: string;
  description: string;
  action?: ReactNode;
  sidebarTitle?: string;
  sidebar: ReactNode;
  children: ReactNode;
  banner?: ReactNode;
}

export function PageLayout({
  title,
  description,
  action,
  sidebarTitle,
  sidebar,
  children,
  banner,
}: PageLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">{description}</p>
        </div>
        {action ? <div className="shrink-0 w-full sm:w-auto">{action}</div> : null}
      </div>

      {banner}

      <div className="grid grid-cols-1 md:grid-cols-[minmax(240px,280px)_1fr] gap-6 items-start">
        <aside className="space-y-4">
          {sidebarTitle ? (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
              {sidebarTitle}
            </p>
          ) : null}
          {sidebar}
        </aside>
        <section className="min-w-0 space-y-6">{children}</section>
      </div>
    </div>
  );
}
