import { useLocation, Link } from 'wouter';
import { Home, Wallet, PieChart, TrendingUp, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/holdings', label: 'Holdings', icon: Wallet },
  { path: '/buckets', label: 'Buckets', icon: PieChart },
  { path: '/projection', label: 'Plan', icon: TrendingUp },
  { path: '/scenarios', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const [location] = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 pb-safe">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path}>
              <div
                className={cn(
                  'flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
