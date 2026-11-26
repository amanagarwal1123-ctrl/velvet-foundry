import React from 'react';
import { PAIRS } from '@/i18n';
import { useApp } from '@/context/AppContext';

// Shows the label in the currently selected language only (toggle switches it).
export const BilingualLabel = ({ k, hi, en, className = '', testId }) => {
  const { L } = useApp();
  const pair = k ? PAIRS[k] : null;
  const hiText = hi || pair?.hi || pair?.en || k || '';
  const enText = en || pair?.en || pair?.hi || k || '';
  return (
    <span className={`text-sm font-medium text-foreground ${className}`} data-testid={testId}>
      {L(hiText, enText)}
    </span>
  );
};
