import { Layout } from '@/components/Layout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { BucketVisualizer } from '@/components/BucketVisualizer';
import { ArrowRight, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

export default function Dashboard() {
  const { holdings, activeScenarioId, scenarios } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);
  
  const totalValue = holdings.reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
  const totalHoldings = holdings.length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground">Retirement Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                    Welcome back. You are viewing <span className="font-semibold text-primary">{scenario?.name}</span>.
                </p>
            </div>
            <div className="flex gap-2 md:gap-3">
                <Link href="/holdings">
                    <Button variant="outline" size="sm" className="md:size-default">Holdings</Button>
                </Link>
                <Link href="/projection">
                    <Button size="sm" className="gap-1 md:gap-2 md:size-default">
                        Projections <ArrowRight size={14} />
                    </Button>
                </Link>
            </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2 md:gap-4">
            <Card className="bg-primary text-primary-foreground border-none shadow-lg">
                <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                    <CardTitle className="text-[10px] md:text-sm font-medium opacity-90">Portfolio</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                    <div className="text-lg md:text-3xl font-mono font-bold tracking-tight">
                        ${(totalValue / 1000000).toFixed(2)}M
                    </div>
                    <div className="text-[10px] md:text-xs mt-1 md:mt-2 opacity-75 flex items-center gap-1">
                        <TrendingUp size={12} />
                        <span className="hidden md:inline">Live Estimate</span>
                        <span className="md:hidden">Live</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                    <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground">Holdings</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                    <div className="text-lg md:text-3xl font-mono font-bold text-foreground">
                        {totalHoldings}
                    </div>
                    <div className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2">
                        {new Set(holdings.map(h => h.accountId)).size} Accts
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                    <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground">Status</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                    <div className="text-sm md:text-xl font-bold text-foreground flex items-center gap-1 md:gap-2">
                        <CheckCircle2 className="text-chart-1" size={16} />
                        <span className="hidden md:inline">On Track</span>
                        <span className="md:hidden">Good</span>
                    </div>
                    <div className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2">
                        <span className="hidden md:inline">Based on ${scenario?.profile.monthlySpending?.toLocaleString()}/mo goal</span>
                        <span className="md:hidden">${scenario?.profile.monthlySpending ? (scenario.profile.monthlySpending/1000).toFixed(1) : '?'}k/mo</span>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Bucket Overview */}
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-serif font-bold">Bucket Allocation</h2>
                <Link href="/buckets">
                    <Button variant="ghost" size="sm">Details</Button>
                </Link>
            </div>
            <BucketVisualizer />
        </section>

      </div>
    </Layout>
  );
}
