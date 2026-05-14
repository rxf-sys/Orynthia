import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileTabbar } from './MobileTabbar';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[260px_1fr]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto w-full max-w-[1480px] px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          <Outlet />
        </main>
      </div>

      <MobileTabbar />
    </div>
  );
}
