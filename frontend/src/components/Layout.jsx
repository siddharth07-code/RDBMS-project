import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  ShieldAlert, 
  BarChart3, 
  Menu, 
  X,
  Database
} from 'lucide-react';
import { fetchHealth } from '../services/api';

export default function Layout() {
  const [dbStatus, setDbStatus] = useState('checking');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then(res => {
        if (res.database === 'CONNECTED') setDbStatus('connected');
        else setDbStatus('error');
      })
      .catch(() => setDbStatus('error'));
  }, []);

  const navItems = [
    { name: 'Overview', to: '/', icon: LayoutDashboard },
    { name: 'Transactions', to: '/transactions', icon: ArrowLeftRight },
    { name: 'Fraud Alerts', to: '/alerts', icon: ShieldAlert },
    { name: 'Research Analytics', to: '/research', icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen flex bg-[#f8f9fa] text-[#111827]">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#e5e7eb] px-4 py-6 justify-between select-none">
        <div>
          <div className="flex items-center gap-2.5 px-3 mb-8">
            <div className="w-6 h-6 rounded bg-[#111827] text-white flex items-center justify-center font-bold text-xs tracking-wider">
              FL
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-tight text-[#111827]">FraudLens</span>
              <span className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">Compliance Suite</span>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-[#f3f4f6] text-[#111827]' 
                        : 'text-[#4b5563] hover:text-[#111827] hover:bg-[#f9fafb]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 text-[#6b7280]" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Database indicator */}
        <div className="px-3 py-3 border-t border-[#f3f4f6] flex items-center justify-between text-xs text-[#6b7280]">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5" />
            <span>MySQL 8.4</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span 
              className={`w-2 h-2 rounded-full ${
                dbStatus === 'connected' 
                  ? 'bg-[#10b981]' 
                  : dbStatus === 'checking' 
                    ? 'bg-[#f59e0b]' 
                    : 'bg-[#ef4444]'
              }`} 
            />
            <span className="capitalize">{dbStatus}</span>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/20" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 bg-white border-r border-[#e5e7eb] p-6 flex flex-col justify-between z-10">
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-[#111827] text-white flex items-center justify-center font-bold text-xs">
                    FL
                  </div>
                  <span className="font-semibold text-sm text-[#111827]">FraudLens</span>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded text-[#6b7280] hover:text-[#111827]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {navItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive 
                            ? 'bg-[#f3f4f6] text-[#111827]' 
                            : 'text-[#4b5563] hover:text-[#111827]'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 text-[#6b7280]" />
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-[#f3f4f6] flex items-center justify-between text-xs text-[#6b7280]">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5" />
                <span>MySQL 8.4</span>
              </div>
              <span className="capitalize">{dbStatus}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#e5e7eb]">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-md text-[#4b5563] hover:bg-[#f3f4f6]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm text-[#111827]">FraudLens</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#6b7280]">
            <span className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`} />
            <span className="capitalize">{dbStatus}</span>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
