import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const CardGridSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
        <Skeleton className="mt-3 h-5 w-2/3" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" />
        </div>
        <Skeleton className="mt-3 h-12 w-full" />
      </div>
    ))}
  </div>
);

export const RowsSkeleton = ({ count = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="h-16 w-full rounded-lg" />
    ))}
  </div>
);
