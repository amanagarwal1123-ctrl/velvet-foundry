import React from 'react';
import { Card } from '@/components/ui/card';
import { BilingualLabel } from '@/components/common/BilingualLabel';

export const KpiTile = ({ labelHi, labelEn, value, sub, icon: Icon, tone = 'primary', testId }) => (
  <Card className="p-4" data-testid={testId}>
    <div className="flex items-start justify-between">
      <BilingualLabel hi={labelHi} en={labelEn} />
      {Icon ? <span className={`rounded-lg bg-accent p-2 text-[hsl(var(--${tone}))]`}><Icon className="h-5 w-5" /></span> : null}
    </div>
    <p className="font-num mt-3 text-3xl font-semibold">{value}</p>
    {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
  </Card>
);

export const MetricTile = ({ k, labelHi, labelEn, value, tone, testId }) => (
  <div className="rounded-lg border border-border bg-card p-3" data-testid={testId}>
    <BilingualLabel k={k} hi={labelHi} en={labelEn} />
    <p className={`font-num mt-1 text-xl font-semibold ${tone ? `text-[hsl(var(--${tone}))]` : ''}`}>{value}</p>
  </div>
);
