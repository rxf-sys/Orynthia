import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileTabbar } from './MobileTabbar';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[260px_1fr]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-elev focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-lg"
      >
        Zum Hauptinhalt springen
      </a>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main
          id="main-content"
          className="mx-auto w-full max-w-[1480px] px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7"
        >
          <Outlet />
        </main>
      </div>

      <MobileTabbar />
    </div>
  );
}
