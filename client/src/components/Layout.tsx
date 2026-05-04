import React from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Wallet, PieChart, TrendingUp, Settings, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { Logo } from '@/components/Logo';

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { scenarios, activeScenarioId } = useStore();
  const activeScenario = scenarios.find(s => s.id === activeScenarioId);

  const navItems = [
    { href: '/', label: 'Home', icon: LayoutDashboard },
    { href: '/holdings', label: 'Holdings', icon: Wallet },
    { href: '/buckets', label: 'Buckets', icon: PieChart },
    { href: '/projection', label: 'Plan', icon: TrendingUp },
    { href: '/scenarios', label: 'Settings', icon: Settings },
    { href: '/report', label: 'Report', icon: FileText, desktopOnly: true },
  ] as const;

  return (
    <div className="min-h-screen bg-background flex font-sans text-foreground">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col fixed h-full z-10">
        <div className="p-5 border-b border-sidebar-border/50">
          <Link href="/" className="flex items-center gap-3 group">
            <Logo size={32} className="text-primary transition-transform group-hover:scale-105" />
            <div className="flex flex-col leading-tight">
              <span className="text-base font-serif font-bold text-sidebar-primary-foreground tracking-tight">
                3-Bucket Plan
              </span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/50 font-medium">
                Retirement Planner
              </span>
            </div>
          </Link>
          {activeScenario && (
            <div className="mt-4 px-2.5 py-1.5 rounded-md bg-sidebar-accent/40 border border-sidebar-border/40">
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-medium">Active Scenario</p>
              <p className="text-xs text-sidebar-foreground font-medium truncate" title={activeScenario.name}>
                {activeScenario.name}
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <item.icon size={18} strokeWidth={isActive ? 2.25 : 1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border/50">
          <div className="rounded-lg p-3 text-[11px] leading-relaxed text-sidebar-foreground/60">
            <p className="font-semibold mb-1 text-sidebar-foreground/80">Educational use only</p>
            Projections are estimates, not financial advice.
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-background/95 backdrop-blur border-b border-border z-50 safe-area-inset-top">
        <div className="flex items-center justify-center h-14 px-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={22} className="text-primary" />
            <h1 className="text-base font-serif font-bold text-foreground">
              3-Bucket Plan
            </h1>
          </Link>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border z-50 pb-safe">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.filter(item => !('desktopOnly' in item && item.desktopOnly)).map((item) => {
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
