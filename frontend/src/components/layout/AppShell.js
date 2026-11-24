import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';

export const AppShell = () => (
  <div className="min-h-screen bg-background">
    <TopBar />
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <Outlet />
      </div>
    </main>
  </div>
);
