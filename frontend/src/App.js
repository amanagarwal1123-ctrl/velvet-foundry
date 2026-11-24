import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AppProvider, useApp } from '@/context/AppContext';
import { AppShell } from '@/components/layout/AppShell';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Bags from '@/pages/Bags';
import BagNew from '@/pages/BagNew';
import BagDetail from '@/pages/BagDetail';
import Packets from '@/pages/Packets';
import PacketDetail from '@/pages/PacketDetail';
import Recovery from '@/pages/Recovery';
import Costing from '@/pages/Costing';
import Deliveries from '@/pages/Deliveries';
import Karigars from '@/pages/Karigars';
import Settings from '@/pages/Settings';
import { Loader2 } from 'lucide-react';

const Protected = ({ children }) => {
  const { token, ready } = useApp();
  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bags" element={<Bags />} />
        <Route path="/bags/new" element={<BagNew />} />
        <Route path="/bags/:id" element={<BagDetail />} />
        <Route path="/packets" element={<Packets />} />
        <Route path="/packets/:id" element={<PacketDetail />} />
        <Route path="/recovery" element={<Recovery />} />
        <Route path="/costing" element={<Costing />} />
        <Route path="/deliveries" element={<Deliveries />} />
        <Route path="/karigars" element={<Karigars />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" richColors={false} />
        </BrowserRouter>
      </AppProvider>
    </div>
  );
}

export default App;
