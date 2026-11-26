import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';

const MAP = {
  open: { hi: 'खुला', en: 'Open', cls: 'bg-[hsl(var(--jewel-sapphire))] text-white' },
  delivered: { hi: 'डिलीवर्ड', en: 'Delivered', cls: 'bg-[hsl(var(--jewel-emerald))] text-white' },
  active: { hi: 'चालू', en: 'Active', cls: 'bg-[hsl(var(--jewel-sapphire))] text-white' },
  split: { hi: 'बंटा', en: 'Split', cls: 'bg-accent text-accent-foreground' },
  merged: { hi: 'मिला', en: 'Merged', cls: 'bg-accent text-accent-foreground' },
  pass: { hi: 'पास', en: 'Pass', cls: 'bg-[hsl(var(--jewel-emerald))] text-white' },
  fail: { hi: 'फेल', en: 'Fail', cls: 'bg-[hsl(var(--jewel-ruby))] text-white' },
  none: { hi: 'बाकी', en: 'Pending', cls: 'bg-muted text-muted-foreground' },
  mixed: { hi: 'मिक्स', en: 'Mixed', cls: 'bg-[hsl(var(--jewel-magenta))] text-white' },
  pending_approval: { hi: 'मंज़ूरी बाकी', en: 'Approval pending', cls: 'bg-[hsl(var(--warning))] text-black' },
  rejected: { hi: 'अस्वीकृत', en: 'Rejected', cls: 'bg-[hsl(var(--jewel-ruby))] text-white' },
};

export const StatusBadge = ({ status, testId }) => {
  const { L } = useApp();
  const s = MAP[status] || { hi: status, en: status, cls: 'bg-muted text-muted-foreground' };
  return (
    <Badge className={`${s.cls} border-0 font-medium`} data-testid={testId}>
      {L(s.hi, s.en)}
    </Badge>
  );
};
