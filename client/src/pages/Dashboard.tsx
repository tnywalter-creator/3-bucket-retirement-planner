import { useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { BucketVisualizer } from '@/components/BucketVisualizer';
import { ArrowRight, TrendingUp, AlertTriangle, CheckCircle2, Wallet, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { calculateRebalancing } from '@/lib/rebalance';
import { runMonteCarlo } from '@/lib/montecarlo';

function fmt(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function Dashboard() {
  const { holdings, activeScenarioId, scenarios, accounts } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);
  const bc = scenario?.bucketConfig;

  const totalValue = holdings.reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
  const withdrawalRate = bc?.withdrawalRate || 4.25;
  const targetPortfolio = scenario ? (scenario.profile.monthlySpending * 12) / (withdrawalRate / 100) : 0;
  const shortfall = targetPortfolio - totalValue;

  // Bucket-target gap: surface the bucket farthest from its target so the
  // dashboard tells you what to move, not just what you have.
  const bucketGap = useMemo(() => {
    if (!bc) return null;
    const { bucketSummary } = calculateRebalancing(holdings, bc);
    const funded = bucketSummary.filter(b => b.targetValue > 0);
    if (funded.length === 0) return null;
    // Worst-funded = lowest percent of target.
    const worst = funded.reduce((a, b) => (a.percentOfTarget <= b.percentOfTarget ? a : b));
    if (worst.action !== 'add') return null; // every bucket meets/exceeds target
    const overfunded = bucketSummary.filter(b => b.action === 'reduce');
    return { worst, overfunded };
  }, [holdings, bc]);

  // Monte Carlo: 250 trials for snappy dashboard load. Re-runs only when scenario or holdings change.
  // Seeded so repeated visits show a stable number (the math is stochastic; the UX shouldn't be).
  const monteCarlo = useMemo(() => {
    if (!scenario || holdings.length === 0) return null;
    return runMonteCarlo(scenario.profile, scenario.bucketConfig, holdings, accounts, { trials: 250, seed: 42 });
  }, [scenario, holdings, accounts]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-serif font-bold tracking-tight" data-testid="text-title">Dashboard</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    <span className="font-semibold text-foreground">{scenario?.name}</span>
                    <span className="mx-2 text-border">·</span>
                    ${scenario?.profile.monthlySpending?.toLocaleString()}/mo target at {withdrawalRate}%
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

        {/* Hero: portfolio value gets the biggest stage; target/progress sits alongside */}
        <Card className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-sidebar via-sidebar to-sidebar/90 text-sidebar-foreground" data-testid="card-portfolio-value">
            <CardContent className="p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-end">
                    <div className="md:col-span-2 space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/55 font-medium flex items-center gap-1.5">
                            <TrendingUp size={12} /> Portfolio Value
                        </p>
                        <div className="text-4xl md:text-6xl font-mono font-bold tracking-tight text-primary leading-none">
                            {fmt(totalValue)}
                        </div>
                        <p className="text-xs text-sidebar-foreground/60">
                            Across {holdings.length} {holdings.length === 1 ? 'holding' : 'holdings'} in {new Set(holdings.map(h => h.accountId)).size} {new Set(holdings.map(h => h.accountId)).size === 1 ? 'account' : 'accounts'}
                        </p>
                    </div>
                    <div className="space-y-3 md:border-l md:border-sidebar-border/40 md:pl-8">
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/55 font-medium">Target</p>
                            <p className="text-lg md:text-2xl font-mono font-bold text-sidebar-foreground">{fmt(targetPortfolio)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/55 font-medium flex items-center gap-1">
                                {shortfall > 0 ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                                {shortfall > 0 ? 'Gap to target' : 'Above target'}
                            </p>
                            <p className={`text-lg md:text-2xl font-mono font-bold ${shortfall > 0 ? 'text-destructive' : 'text-primary'}`}>
                                {shortfall > 0 ? '−' : '+'}{fmt(Math.abs(shortfall))}
                            </p>
                        </div>
                        {/* Progress bar visualizing % of target */}
                        <div className="pt-1">
                            <div className="h-1.5 w-full rounded-full bg-sidebar-foreground/10 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-primary transition-all duration-700"
                                    style={{ width: `${Math.min(100, targetPortfolio > 0 ? (totalValue / targetPortfolio) * 100 : 0)}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-sidebar-foreground/55 mt-1.5 font-mono">
                                {targetPortfolio > 0 ? Math.min(999, (totalValue / targetPortfolio) * 100).toFixed(0) : 0}% of target
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        {monteCarlo && (() => {
          const pct = Math.round(monteCarlo.successRate * 100);
          const tone = pct >= 85 ? 'primary' : pct >= 70 ? 'amber' : 'destructive';
          const Icon = pct >= 85 ? CheckCircle2 : pct >= 70 ? Shield : AlertTriangle;
          const headline = pct >= 85
            ? 'Plan looks resilient under stress'
            : pct >= 70
              ? 'Plan is workable but exposed to bad markets'
              : 'Plan is fragile — likely to run out';
          const sub = `Across 250 simulations of varying market returns, your portfolio survived to age ${scenario?.profile.lifeExpectancy} in ${pct}% of trials.`;
          return (
            <Card data-testid="card-success-probability"
              className={tone === 'primary'
                ? 'border-primary/40 bg-primary/5'
                : tone === 'amber'
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-destructive/40 bg-destructive/5'}>
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <div className={`rounded-full p-2 flex-shrink-0 ${
                    tone === 'primary' ? 'bg-primary/15 text-primary'
                    : tone === 'amber' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-500'
                    : 'bg-destructive/15 text-destructive'}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1">
                      <p className="font-semibold text-foreground">
                        Success probability:{' '}
                        <span className={`font-mono ${
                          tone === 'primary' ? 'text-primary'
                          : tone === 'amber' ? 'text-amber-700 dark:text-amber-500'
                          : 'text-destructive'}`}>{pct}%</span>
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        Median final: ${(monteCarlo.percentiles.p50 / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K
                        {' · '}
                        Worst 5%: ${Math.max(0, monteCarlo.percentiles.p5 / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K
                      </p>
                    </div>
                    <p className="text-sm text-foreground mt-1.5">{headline}.</p>
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                    <Link href="/projection">
                      <Button variant="link" size="sm" className="px-0 h-auto mt-1">
                        See the full stress test <ArrowRight size={12} className="ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {bucketGap && (
          <Card className="border-destructive/50 bg-destructive/5" data-testid="card-bucket-gap">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-destructive/15 p-2 text-destructive flex-shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1">
                    <p className="font-semibold text-foreground">
                      {bucketGap.worst.label} is{' '}
                      <span className="text-destructive font-mono">
                        {bucketGap.worst.percentOfTarget.toFixed(0)}%
                      </span>{' '}
                      funded
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{fmt(bucketGap.worst.currentValue)}</span> of{' '}
                      <span className="font-mono">{fmt(bucketGap.worst.targetValue)}</span> target
                    </p>
                  </div>
                  <p className="text-sm text-foreground mt-1.5">
                    Move <span className="font-mono font-bold text-destructive">{fmt(Math.abs(bucketGap.worst.difference))}</span>
                    {bucketGap.overfunded.length > 0 ? (
                      <> from {bucketGap.overfunded.map(b => b.label).join(' or ')} into {bucketGap.worst.label} to align with the strategy.</>
                    ) : (
                      <> into {bucketGap.worst.label} to align with the strategy.</>
                    )}
                  </p>
                  <Link href="/buckets">
                    <Button variant="link" size="sm" className="px-0 h-auto text-destructive mt-1" data-testid="button-bucket-gap-action">
                      <Wallet size={14} className="mr-1" /> Open rebalancing dashboard <ArrowRight size={12} className="ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
