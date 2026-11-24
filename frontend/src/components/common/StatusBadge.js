import React from 'react';
import { Badge } from '@/components/ui/badge';

const MAP = {
  open: { hi: 'खुला', en: 'Open', cls: 'bg-[hsl(var(--info))] text-white' },
  delivered: { hi: 'डिलीवर्ड', en: 'Delivered', cls: 'bg-[hsl(var(--success))] text-white' },
  active: { hi: 'चालू', en: 'Active', cls: 'bg-[hsl(var(--info))] text-white' },
  split: { hi: 'बंटा', en: 'Split', cls: 'bg-accent text-accent-foreground' },
  merged: { hi: 'मिला', en: 'Merged', cls: 'bg-accent text-accent-foreground' },
  pass: { hi: 'पास', en: 'Pass', cls: 'bg-[hsl(var(--success))] text-white' },
  fail: { hi: 'फेल', en: 'Fail', cls: 'bg-[hsl(var(--danger))] text-white' },
  none: { hi: '-', en: 'Pending', cls: 'bg-muted text-muted-foreground' },
  mixed: { hi: 'मिक्स', en: 'Mixed', cls: 'bg-[hsl(var(--warning))] text-black' },
};

export const StatusBadge = ({ status, testId }) => {
  const s = MAP[status] || { hi: status, en: status, cls: 'bg-muted text-muted-foreground' };
  return (
    <Badge className={`${s.cls} border-0 font-medium`} data-testid={testId}>
      {s.hi}{s.en && s.hi !== s.en ? ` / ${s.en}` : ''}
    </Badge>
  );
};
