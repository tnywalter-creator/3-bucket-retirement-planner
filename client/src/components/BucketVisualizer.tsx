import { useStore } from '@/lib/store';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function formatDollars(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export function BucketVisualizer() {
  const { holdings, scenarios, activeScenarioId } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);

  const totals = holdings.reduce((acc, h) => {
    const val = h.quantity * h.currentPrice;
    acc[h.bucket] = (acc[h.bucket] || 0) + val;
    acc.total = (acc.total || 0) + val;
    return acc;
  }, { cash: 0, bridge: 0, growth: 0, unassigned: 0, total: 0 } as Record<string, number>);

  const bc = scenario?.bucketConfig;

  const data = [
    { name: 'B1: Cash Reserve', value: totals.cash, color: 'hsl(var(--chart-3))', type: 'cash' },
    { name: 'B2: Bridge', value: totals.bridge, color: 'hsl(var(--chart-2))', type: 'bridge' },
    { name: 'B3: Growth', value: totals.growth, color: 'hsl(var(--chart-1))', type: 'growth' },
  ].filter(d => d.value > 0);

  if (totals.unassigned > 0) {
    data.push({ name: 'Unassigned', value: totals.unassigned, color: 'hsl(var(--muted-foreground))', type: 'unassigned' });
  }

  const bucketStats = [
    {
      label: 'B1: Cash Reserve',
      sublabel: `Years 1-${bc?.cashTargetYears || 3}`,
      current: totals.cash,
      target: bc?.cashTarget || 288000,
      colorClass: 'bg-chart-3',
      textClass: 'text-chart-3',
      timeline: 'Spend first. Zero market risk.',
    },
    {
      label: 'B2: Bridge',
      sublabel: `Years ${(bc?.cashTargetYears || 3) + 1}-${(bc?.cashTargetYears || 3) + (bc?.bridgeTargetYears || 7)}`,
      current: totals.bridge,
      target: bc?.bridgeTarget || 672000,
      colorClass: 'bg-chart-2',
      textClass: 'text-chart-2',
      timeline: 'Moderate growth. Refills Bucket 1.',
    },
    {
      label: 'B3: Growth',
      sublabel: `Year ${(bc?.cashTargetYears || 3) + (bc?.bridgeTargetYears || 7) + 1}+`,
      current: totals.growth,
      target: bc?.growthTarget || 1384000,
      colorClass: 'bg-chart-1',
      textClass: 'text-chart-1',
      timeline: 'Aggressive. Don\'t touch.',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle className="font-serif">Current Allocation</CardTitle>
                <CardDescription>
                    Total Portfolio: <span className="font-mono font-bold text-primary">{formatDollars(totals.total)}</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="45%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                        </Pie>
                        <Tooltip 
                            formatter={(value: number) => `$${value.toLocaleString()}`}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <Card className="md:col-span-1 bg-muted/30 border-none shadow-none">
            <CardHeader>
                <CardTitle className="text-lg font-serif">Funding Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
                {bucketStats.map((b) => {
                  const pct = b.target > 0 ? Math.min((b.current / b.target) * 100, 100) : 0;
                  const funded = b.current >= b.target;
                  const gap = b.target - b.current;
                  return (
                    <div key={b.label} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                            <div>
                                <span className="font-medium">{b.label}</span>
                                <span className="text-[10px] text-muted-foreground ml-1.5">{b.sublabel}</span>
                            </div>
                            <span className={cn("font-mono text-xs font-bold", funded ? "text-primary" : "text-destructive")}>
                                {pct.toFixed(0)}%
                            </span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full transition-all duration-500 rounded-full", b.colorClass)} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{formatDollars(b.current)} / {formatDollars(b.target)}</span>
                            {!funded && <span className="text-destructive">Gap: {formatDollars(gap)}</span>}
                            {funded && <span className="text-primary">Funded</span>}
                        </div>
                    </div>
                  );
                })}
            </CardContent>
        </Card>
    </div>
  );
}
