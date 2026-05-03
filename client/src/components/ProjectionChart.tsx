import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { runProjection, compareSSClaimingAges } from '@/lib/engine';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart, Line, ReferenceLine } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CalendarClock, TrendingUp } from 'lucide-react';

export function ProjectionChart() {
  const { activeScenarioId, scenarios, holdings } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);

  const data = useMemo(() => {
    if (!scenario) return [];
    return runProjection(scenario.profile, scenario.bucketConfig, holdings);
  }, [scenario, holdings]);

  const ssComparison = useMemo(() => {
    if (!scenario) return [];
    return compareSSClaimingAges(scenario.profile, scenario.bucketConfig, holdings);
  }, [scenario, holdings]);

  if (!scenario || data.length === 0) return <div className="text-muted-foreground text-sm p-4">No data to project</div>;

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
      {depletionYear && (
        <Card className="border-destructive bg-destructive/5" data-testid="card-depletion-warning">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-destructive">
              Portfolio depleted at age {depletionYear.age} ({depletionYear.year})
            </p>
          </CardContent>
        </Card>
      )}

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
