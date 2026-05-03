import { Layout } from '@/components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { BucketVisualizer } from '@/components/BucketVisualizer';
import { ArrowRight, TrendingUp, Target, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

function fmt(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function Dashboard() {
  const { holdings, activeScenarioId, scenarios } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);
  const bc = scenario?.bucketConfig;
  
  const totalValue = holdings.reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
  const withdrawalRate = bc?.withdrawalRate || 4.25;
  const targetPortfolio = scenario ? (scenario.profile.monthlySpending * 12) / (withdrawalRate / 100) : 0;
  const shortfall = targetPortfolio - totalValue;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground" data-testid="text-title">Retirement Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                    <span className="font-semibold text-primary">{scenario?.name}</span> &middot; ${scenario?.profile.monthlySpending?.toLocaleString()}/mo at {withdrawalRate}%
                </p>
            </div>
            <div className="flex gap-2 md:gap-3">
                <Link href="/holdings">
                    <Button variant="outline" size="sm" data-testid="button-holdings">Holdings</Button>
                </Link>
                <Link href="/projection">
                    <Button size="sm" className="gap-1 md:gap-2" data-testid="button-projections">
                        Projections <ArrowRight size={14} />
                    </Button>
                </Link>
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            <Card className="bg-primary text-primary-foreground border-none shadow-lg" data-testid="card-portfolio-value">
                <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                    <CardTitle className="text-[10px] md:text-sm font-medium opacity-90">Portfolio Value</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                    <div className="text-lg md:text-3xl font-mono font-bold tracking-tight">
                        {fmt(totalValue)}
                    </div>
                    <div className="text-[10px] md:text-xs mt-1 md:mt-2 opacity-75 flex items-center gap-1">
                        <TrendingUp size={12} />
                        <span className="hidden md:inline">Pre-tax total</span>
                        <span className="md:hidden">Pre-tax</span>
                    </div>
                </CardContent>
            </Card>

            <Card data-testid="card-target">
                <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                    <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground">Target</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                    <div className="text-lg md:text-3xl font-mono font-bold text-foreground">
                        {fmt(targetPortfolio)}
                    </div>
                    <div className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2 flex items-center gap-1">
                        <Target size={12} />
                        <span className="hidden md:inline">${scenario?.profile.monthlySpending?.toLocaleString()}/mo at {withdrawalRate}%</span>
                        <span className="md:hidden">{withdrawalRate}% rate</span>
                    </div>
                </CardContent>
            </Card>

            <Card data-testid="card-shortfall">
                <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                    <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground">
                        {shortfall > 0 ? 'Shortfall' : 'Surplus'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                    <div className={`text-lg md:text-3xl font-mono font-bold ${shortfall > 0 ? 'text-destructive' : 'text-primary'}`}>
                        {fmt(Math.abs(shortfall))}
                    </div>
                    <div className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2 flex items-center gap-1">
                        {shortfall > 0 
                          ? <><AlertTriangle size={12} className="text-destructive" /><span className="hidden md:inline">Growth + consulting closes gap</span><span className="md:hidden">Closeable</span></>
                          : <><CheckCircle2 size={12} className="text-primary" /><span>On track</span></>
                        }
                    </div>
                </CardContent>
            </Card>

            <Card data-testid="card-holdings-count">
                <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                    <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground">Holdings</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                    <div className="text-lg md:text-3xl font-mono font-bold text-foreground">
                        {holdings.length}
                    </div>
                    <div className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2">
                        {new Set(holdings.map(h => h.accountId)).size} Accounts
                    </div>
                </CardContent>
            </Card>
        </div>

        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-serif font-bold">Bucket Allocation</h2>
                <Link href="/buckets">
                    <Button variant="ghost" size="sm" data-testid="button-bucket-details">Details</Button>
                </Link>
            </div>
            <BucketVisualizer />
        </section>

      </div>
    </Layout>
  );
}
