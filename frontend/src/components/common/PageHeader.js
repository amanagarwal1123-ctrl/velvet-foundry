import React from 'react';

export const PageHeader = ({ titleHi, titleEn, subtitle, actions, testId }) => (
  <div className="flex flex-wrap items-end justify-between gap-3" data-testid={testId}>
    <div className="leading-tight">
      <h1 className="text-2xl font-semibold md:text-3xl">{titleHi}</h1>
      <p className="text-sm text-muted-foreground">{titleEn}{subtitle ? ` · ${subtitle}` : ''}</p>
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);
