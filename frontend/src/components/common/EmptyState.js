import React from 'react';
import { Inbox } from 'lucide-react';

export const EmptyState = ({ icon: Icon = Inbox, title, subtitle, action, testId = 'empty-state' }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center" data-testid={testId}>
    <div className="mb-4 rounded-full bg-accent p-4 text-primary">
      <Icon className="h-8 w-8" />
    </div>
    {title ? <p className="text-lg font-semibold">{title}</p> : null}
    {subtitle ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{subtitle}</p> : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);
