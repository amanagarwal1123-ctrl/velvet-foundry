import React from 'react';
import { PAIRS } from '@/i18n';

// Always shows both languages stacked (Hindi first) for low-literacy scanning.
export const BilingualLabel = ({ k, hi, en, className = '', testId }) => {
  const pair = k ? PAIRS[k] : null;
  const hiText = hi || pair?.hi || '';
  const enText = en || pair?.en || k || '';
  return (
    <span className={`leading-tight inline-block ${className}`} data-testid={testId}>
      {hiText ? <span className="block text-sm font-medium text-foreground">{hiText}</span> : null}
      <span className="block text-xs text-muted-foreground">{enText}</span>
    </span>
  );
};
