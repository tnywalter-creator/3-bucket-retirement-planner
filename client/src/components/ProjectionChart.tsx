import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { runProjection, compareSSClaimingAges } from '@/lib/engine';
import { runMonteCarlo } from '@/lib/montecarlo';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart, Line, ReferenceLine } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CalendarClock, TrendingUp, Activity } from 'lucide-react';

interface ProjectionChartProps {
  useTargets?: boolean;
}

export function ProjectionChart({ useTargets = false }: ProjectionChartProps) {
  const { activeScenarioId, scenarios, holdings, accounts } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);

  // When useTargets is true, build synthetic holdings from the bucket target amounts
  // so the user can see a fully-funded projection before entering real positions.
  const effectiveHoldings = useMemo(() => {
    if (!useTargets || !scenario) return holdings;
    const bc = scenario.bucketConfig;
    return [
      { id: '__target_cash', ticker: 'CASH', name: 'Cash Reserve (target)', bucket: 'cash' as const, quantity: bc.cashTarget, currentPrice: 1, accountId: '__target', type: 'cash' as const, lastUpdated: '', isManualPrice: true },
      { id: '__target_bridge', ticker: 'BRIDGE', name: 'Bridge (target)', bucket: 'bridge' as const, quantity: bc.bridgeTarget, currentPrice: 1, accountId: '__target', type: 'etf' as const, lastUpdated: '', isManualPrice: true },
      { id: '__target_growth', ticker: 'GROWTH', name: 'Growth (target)', bucket: 'growth' as const, quantity: bc.growthTarget, currentPrice: 1, accountId: '__target', type: 'etf' as const, lastUpdated: '', isManualPrice: true },
    ];
  }, [useTargets, scenario, holdings]);

  const data = useMemo(() => {
    if (!scenario) return [];
    return runProjection(scenario.profile, scenario.bucketConfig, effectiveHoldings, { accounts: useTargets ? [] : accounts });
  }, [scenario, effectiveHoldings, accounts, useTargets]);

  const totalHoldingsValue = holdings.reduce((s, h) => s + h.quantity * h.currentPrice, 0);
  const bucketedValue = holdings
    .filter(h => h.bucket !== 'unassigned')
    .reduce((s, h) => s + h.quantity * h.currentPrice, 0);
  const allUnassigned = !useTargets && totalHoldingsValue > 0 && bucketedValue === 0;
  const partiallyUnassigned = !useTargets && totalHoldingsValue > 0 && bucketedValue > 0 && bucketedValue < totalHoldingsValue * 0.95;

  const ssComparison = useMemo(() => {
    if (!scenario) return [];
    return compareSSClaimingAges(scenario.profile, scenario.bucketConfig, effectiveHoldings);
  }, [scenario, effectiveHoldings]);

  // Full Monte Carlo: 1000 trials. Seeded so the chart is stable across renders.
  const monteCarlo = useMemo(() => {
    if (!scenario || effectiveHoldings.length === 0) return null;
    return runMonteCarlo(scenario.profile, scenario.bucketConfig, effectiveHoldings, useTargets ? [] : accounts, { trials: 1000, seed: 42 });
  }, [scenario, effectiveHoldings, accounts, useTargets]);

  if (!scenario || data.length === 0) return <div className="text-muted-foreground text-sm p-4">No data to project</div>;

  if (allUnassigned) {
    return (
      <Card className="border-destructive bg-destructive/5" data-testid="card-unassigned-warning">
        <CardContent className="p-4 space-y-1">
          <p className="text-sm font-semibold text-destructive">
            You have ${(totalHoldingsValue / 1000).toFixed(0)}K in holdings but none are assigned to a bucket.
          </p>
          <p className="text-xs text-muted-foreground">
            Go to <strong>Holdings</strong> and assign each position to Cash Reserve, Bridge, or Growth — the projection needs bucket assignments to model your portfolio correctly.
          </p>
        </CardContent>
      </Card>
    );
  }

  const depletionYear = data.find(d => d.totalPortfolio <= 0);
  const finalBalance = data[data.length - 1]?.totalPortfolio || 0;
  const ssStartAge = scenario.profile.socialSecurityAge;
  const spouseSsStartAge = scenario.profile.spouseSocialSecurityAge;
  const retirementAge = scenario.profile.retirementAge ?? scenario.profile.currentAge;
  const cashEndAge = retirementAge + scenario.bucketConfig.cashTargetYears;
  const bridgeEndAge = cashEndAge + scenario.bucketConfig.bridgeTargetYears;

  const incomeBreakdown = data.map(d => ({
    age: d.age,
    'Social Security': d.ssIncome,
    'Spouse SS': d.spouseSsIncome,
    'Other Income': d.otherIncome,
    'Portfolio Withdrawal': d.withdrawalNeeded,
    'Tax on Withdrawal': d.taxOnWithdrawal,
    'Spending Need': d.spendingNeed,
  }));

  return (
    <div className="space-y-8">
      {partiallyUnassigned && (
        <Card className="border-amber-500 bg-amber-500/5" data-testid="card-partial-unassigned-warning">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              ${((totalHoldingsValue - bucketedValue) / 1000).toFixed(0)}K of your holdings are unassigned and excluded from this projection.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Assign all holdings in the <strong>Holdings</strong> page for an accurate forecast.
            </p>
          </CardContent>
        </Card>
      )}

      {depletionYear && (
        <Card className="border-destructive bg-destructive/5" data-testid="card-depletion-warning">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-destructive">
              Deterministic projection depletes at age {depletionYear.age} ({depletionYear.year}). See the stress test below for the range of outcomes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* What's driving this result */}
      {(() => {
        const ssMonthly = scenario.profile.socialSecurityAmount ?? 0;
        const spouseSsMonthly = scenario.profile.spouseSocialSecurityAmount ?? 0;
        const totalSsMonthly = ssMonthly + spouseSsMonthly;
        const totalSsAnnual = totalSsMonthly * 12;
        const spendingAnnual = scenario.profile.monthlySpending * 12;
        const ssCoverage = Math.round((totalSsAnnual / spendingAnnual) * 100);
        const age67 = data.find(d => d.age === scenario.profile.socialSecurityAge);
        const finalRow = data[data.length - 1];
        const bc = scenario.bucketConfig;
        const blended = (
          bc.cashTarget * (bc.cashReturn / 100) +
          bc.bridgeTarget * (bc.bridgeReturn / 100) +
          bc.growthTarget * (bc.growthReturn / 100)
        ) / (bc.cashTarget + bc.bridgeTarget + bc.growthTarget);
        return (
          <Card className="border-muted bg-muted/10" data-testid="card-assumptions-insight">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Why does this differ from other tools?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-md border bg-background p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Blended Return Rate</p>
                  <p className="text-lg font-mono font-bold">{(blended * 100).toFixed(1)}%</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Cash {bc.cashReturn}% · Bridge {bc.bridgeReturn}% · Growth {bc.growthReturn}%
                    <br/>Change in Settings → Buckets.
                  </p>
                </div>
                <div className={`rounded-md border p-3 ${totalSsMonthly > 0 ? 'bg-primary/5 border-primary/20' : 'bg-background'}`}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Social Security Income</p>
                  {totalSsMonthly > 0 ? (
                    <>
                      <p className="text-lg font-mono font-bold">${totalSsMonthly.toLocaleString()}/mo</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Covers <strong>{ssCoverage}%</strong> of spending in today's dollars after age {scenario.profile.socialSecurityAge}.
                        {age67 && <> Portfolio only needs ${Math.round(age67.withdrawalNeeded / 1000)}K/yr by then.</>}
                        {' '}Many tools exclude SS or use different amounts.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-mono font-bold">$0</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">No SS income set. Add it in Settings → Profile to see the full picture.</p>
                    </>
                  )}
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Starting Portfolio</p>
                  <p className="text-lg font-mono font-bold">
                    ${Math.round((bc.cashTarget + bc.bridgeTarget + bc.growthTarget) / 1000)}K
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {useTargets
                      ? 'Simulated from fully-funded targets. Enter your actual holdings for a real starting balance.'
                      : `Your bucketed holdings. Ending balance at ${finalRow?.age ?? scenario.profile.lifeExpectancy}: $${Math.round((finalRow?.totalPortfolio ?? 0) / 1000)}K.`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <ErrorBoundary fallbackTitle="Stress Test Error">
        {monteCarlo && (() => {
          const pct = Math.round(monteCarlo.successRate * 100);
          const tone = pct >= 85 ? 'primary' : pct >= 70 ? 'amber' : 'destructive';
          const fanData = monteCarlo.byYear.map(d => ({
            age: d.age,
            p5: Math.max(0, d.p5),
            p25: Math.max(0, d.p25),
            p50: Math.max(0, d.p50),
            p75: Math.max(0, d.p75),
            p95: Math.max(0, d.p95),
            // For stacked area: p5 is the floor, then differences between bands
            band5_25: Math.max(0, d.p25 - d.p5),
            band25_50: Math.max(0, d.p50 - d.p25),
            band50_75: Math.max(0, d.p75 - d.p50),
            band75_95: Math.max(0, d.p95 - d.p75),
          }));
          const medianDepletion = monteCarlo.depletionAges.length > 0
            ? Math.round(monteCarlo.depletionAges.slice().sort((a, b) => a - b)[Math.floor(monteCarlo.depletionAges.length / 2)])
            : null;
          return (
            <Card data-testid="card-monte-carlo">
              <CardHeader>
                <CardTitle className="font-serif flex items-center gap-2">
                  <Activity size={18} /> Stress Test (1,000 simulations)
                </CardTitle>
                <CardDescription>
                  Returns sampled from a normal distribution year by year. Bands show the range of portfolio outcomes — darker = more likely.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className={`p-3 rounded-lg ${
                    tone === 'primary' ? 'bg-primary/10 border border-primary/30'
                    : tone === 'amber' ? 'bg-amber-500/10 border border-amber-500/30'
                    : 'bg-destructive/10 border border-destructive/30'}`}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Success Rate</p>
                    <p className={`text-2xl font-mono font-bold ${
                      tone === 'primary' ? 'text-primary'
                      : tone === 'amber' ? 'text-amber-700 dark:text-amber-500'
                      : 'text-destructive'}`}>{pct}%</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Survives to age {scenario.profile.lifeExpectancy}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Median Final</p>
                    <p className="text-2xl font-mono font-bold">${Math.round(monteCarlo.percentiles.p50/1000).toLocaleString()}K</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">50th percentile</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Worst Case (5%)</p>
                    <p className="text-2xl font-mono font-bold">${Math.round(Math.max(0, monteCarlo.percentiles.p5)/1000).toLocaleString()}K</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">5th percentile</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Median Depletion</p>
                    <p className="text-2xl font-mono font-bold">{medianDepletion ? `Age ${medianDepletion}` : 'None'}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">In {monteCarlo.depletionAges.length} of 1000 trials</p>
                  </div>
                </div>
                <div className="h-[280px] md:h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={fanData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${Math.round(v/1000)}k`} tick={{ fontSize: 11 }} width={45} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <Tooltip
                        formatter={(_value: number, name: string, item: any) => {
                          // Show actual percentile values on hover, not the band deltas
                          const d = item?.payload;
                          if (!d) return ['', name];
                          const map: Record<string, [string, number]> = {
                            'Floor (p5)': ['p5', d.p5],
                            'p5–p25 band': ['p25', d.p25],
                            'p25–p50 band': ['p50 (median)', d.p50],
                            'p50–p75 band': ['p75', d.p75],
                            'p75–p95 band': ['p95', d.p95],
                          };
                          const [label, val] = map[name] ?? [name, _value];
                          return [`$${Math.round(val).toLocaleString()}`, label];
                        }}
                        labelFormatter={(age) => `Age ${age}`}
                      />
                      <Area type="monotone" dataKey="p5" stackId="fan" stroke="none" fill="transparent" name="Floor (p5)" />
                      <Area type="monotone" dataKey="band5_25" stackId="fan" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.15} name="p5–p25 band" />
                      <Area type="monotone" dataKey="band25_50" stackId="fan" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.30} name="p25–p50 band" />
                      <Area type="monotone" dataKey="band50_75" stackId="fan" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.30} name="p50–p75 band" />
                      <Area type="monotone" dataKey="band75_95" stackId="fan" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.15} name="p75–p95 band" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                  Darker band = middle 50% of outcomes. Lighter wings = the worst and best 25%. The deterministic chart below shows one scenario; this shows the range.
                </p>
              </CardContent>
            </Card>
          );
        })()}
      </ErrorBoundary>

      <ErrorBoundary fallbackTitle="Chart Error">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Portfolio Balance Projection</CardTitle>
            <CardDescription>Stacked by bucket with milestone markers</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] md:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBridge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : `${Math.round(val/1000)}k`} tick={{ fontSize: 11 }} width={45} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <Tooltip formatter={(value: number) => `$${Math.round(value).toLocaleString()}`} />
                <Legend />
                {retirementAge > scenario.profile.currentAge && (
                  <ReferenceLine x={retirementAge} stroke="hsl(var(--foreground))" strokeDasharray="4 4" label={{ value: 'Retire', position: 'top', fontSize: 9 }} />
                )}
                <ReferenceLine x={cashEndAge} stroke="hsl(var(--chart-3))" strokeDasharray="5 5" label={{ value: 'Cash ends', position: 'top', fontSize: 9 }} />
                <ReferenceLine x={bridgeEndAge} stroke="hsl(var(--chart-2))" strokeDasharray="5 5" label={{ value: 'Bridge ends', position: 'top', fontSize: 9 }} />
                {ssStartAge <= scenario.profile.lifeExpectancy && (
                  <ReferenceLine x={ssStartAge} stroke="hsl(var(--primary))" strokeDasharray="3 3" label={{ value: 'SS starts', position: 'insideTopRight', fontSize: 9 }} />
                )}
                <Area type="monotone" dataKey="endBalanceGrowth" stackId="1" stroke="hsl(var(--chart-1))" fill="url(#colorGrowth)" name="B3: Growth" />
                <Area type="monotone" dataKey="endBalanceBridge" stackId="1" stroke="hsl(var(--chart-2))" fill="url(#colorBridge)" name="B2: Bridge" />
                <Area type="monotone" dataKey="endBalanceCash" stackId="1" stroke="hsl(var(--chart-3))" fill="url(#colorCash)" name="B1: Cash" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </ErrorBoundary>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ErrorBoundary fallbackTitle="Income Chart Error">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Income Breakdown</CardTitle>
              <CardDescription>Where your income comes from each year</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={incomeBreakdown}>
                  <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : `${Math.round(val/1000)}k`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value: number) => `$${Math.round(value).toLocaleString()}`} />
                  <Legend />
                  <Area type="monotone" dataKey="Portfolio Withdrawal" stackId="1" stroke="hsl(var(--sidebar-accent))" fill="hsl(var(--sidebar-accent))" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Social Security" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                  <Area type="monotone" dataKey="Spouse SS" stackId="1" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.4} />
                  <Area type="monotone" dataKey="Other Income" stackId="1" stroke="hsl(var(--chart-5))" fill="hsl(var(--chart-5))" fillOpacity={0.4} />
                  <Line type="monotone" dataKey="Spending Need" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </ErrorBoundary>

        <ErrorBoundary fallbackTitle="Withdrawal Chart Error">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Withdrawal Sequence</CardTitle>
              <CardDescription>Amount drawn from portfolio + tax impact</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : `${Math.round(val/1000)}k`} tick={{ fontSize: 11 }} width={45}/>
                  <Tooltip 
                    formatter={(value: number) => `$${Math.round(value).toLocaleString()}`} 
                    labelFormatter={(age) => `Age ${age}`}
                  />
                  <Legend />
                  <Bar dataKey="withdrawalNeeded" stackId="w" fill="hsl(var(--sidebar-accent))" name="Net Withdrawal" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="taxOnWithdrawal" stackId="w" fill="hsl(var(--destructive))" name="Taxes" opacity={0.6} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </ErrorBoundary>
      </div>

      <ErrorBoundary fallbackTitle="SS Comparison Error">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <CalendarClock size={18} /> Social Security Claiming Strategy
            </CardTitle>
            <CardDescription>Compare different claiming ages and their impact on your plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ssComparison.map(ss => {
                const isCurrent = ss.claimAge === scenario.profile.socialSecurityAge;
                return (
                  <div key={ss.claimAge} className={`p-3 rounded-lg border-2 ${isCurrent ? 'border-primary bg-primary/5' : 'border-border'}`} data-testid={`card-ss-age-${ss.claimAge}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-lg font-bold font-mono">Age {ss.claimAge}</p>
                      {isCurrent && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Current</span>}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monthly</span>
                        <span className="font-mono font-semibold">${ss.monthlyBenefit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lifetime</span>
                        <span className="font-mono font-semibold">${(ss.lifetimeTotal/1000000).toFixed(2)}M</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Portfolio End</span>
                        <span className={`font-mono font-semibold ${ss.portfolioAtEnd > 0 ? 'text-primary' : 'text-destructive'}`}>
                          {ss.portfolioAtEnd >= 1000000 ? `$${(ss.portfolioAtEnd/1000000).toFixed(1)}M` : ss.portfolioAtEnd > 0 ? `$${(ss.portfolioAtEnd/1000).toFixed(0)}K` : 'Depleted'}
                        </span>
                      </div>
                      {ss.depletionAge && (
                        <p className="text-destructive font-semibold text-center mt-1">Runs out age {ss.depletionAge}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </ErrorBoundary>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <TrendingUp size={18} /> Projection Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">Final Balance</p>
              <p className="text-lg font-mono font-bold" data-testid="text-final-balance">
                {finalBalance >= 1000000 ? `$${(finalBalance/1000000).toFixed(1)}M` : `$${Math.round(finalBalance/1000)}K`}
              </p>
              <p className="text-[10px] text-muted-foreground">at age {scenario.profile.lifeExpectancy}</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">Withdrawal Rate</p>
              <p className="text-lg font-mono font-bold">{scenario.bucketConfig.withdrawalRate}%</p>
              <p className="text-[10px] text-muted-foreground">${scenario.profile.monthlySpending.toLocaleString()}/mo</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">Cash Phase</p>
              <p className="text-lg font-mono font-bold">Years 1-{scenario.bucketConfig.cashTargetYears}</p>
              <p className="text-[10px] text-muted-foreground">Zero market risk</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">Bridge Phase</p>
              <p className="text-lg font-mono font-bold">Years {scenario.bucketConfig.cashTargetYears + 1}-{scenario.bucketConfig.cashTargetYears + scenario.bucketConfig.bridgeTargetYears}</p>
              <p className="text-[10px] text-muted-foreground">Moderate growth</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
