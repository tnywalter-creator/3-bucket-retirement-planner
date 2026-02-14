import React from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Wallet, PieChart, TrendingUp, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: '/', label: 'Home', icon: LayoutDashboard },
    { href: '/holdings', label: 'Holdings', icon: Wallet },
    { href: '/buckets', label: 'Buckets', icon: PieChart },
    { href: '/projection', label: 'Plan', icon: TrendingUp },
    { href: '/scenarios', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex font-sans text-foreground">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col fixed h-full z-10">
        <div className="p-6 border-b border-sidebar-border/50">
          <h1 className="text-xl font-serif font-bold text-sidebar-primary-foreground tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <PieChart size={18} />
            </div>
            3-Bucket Plan
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" 
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border/50">
          <div className="bg-sidebar-accent/30 rounded-lg p-3 text-xs text-sidebar-foreground/60">
            <p className="font-semibold mb-1 text-sidebar-foreground">Disclaimer</p>
            For educational planning only. Not financial advice.
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-background/95 backdrop-blur border-b border-border z-50 safe-area-inset-top">
        <div className="flex items-center justify-center h-14 px-4">
          <h1 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
              <PieChart size={14} />
            </div>
            3-Bucket Plan
          </h1>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border z-50 pb-safe">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center min-w-[60px] py-2 rounded-lg transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground active:text-foreground'
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 bg-background min-h-screen pt-16 pb-20 md:pt-0 md:pb-0">
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
