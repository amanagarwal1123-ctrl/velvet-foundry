import React from 'react';
import { useApp } from '@/context/AppContext';

export const PageHeader = ({ title, titleHi, titleEn, subtitle, actions, testId }) => {
  const { L } = useApp();
  const head = title != null ? title : L(titleHi, titleEn);
  return (
    <div className="flex flex-wrap items-end justify-between gap-3" data-testid={testId}>
      <div className="leading-tight">
        <h1 className="text-2xl font-semibold md:text-3xl">{head}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
};
