import { useStore } from '@/lib/store';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { BucketType } from '@/lib/types';
import { cn } from '@/lib/utils';

export function BucketVisualizer() {
  const { holdings, scenarios, activeScenarioId } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);

  // Calculate totals
  const totals = holdings.reduce((acc, h) => {
    const val = h.quantity * h.currentPrice;
    acc[h.bucket] = (acc[h.bucket] || 0) + val;
    acc.total = (acc.total || 0) + val;
    return acc;
  }, { cash: 0, income: 0, growth: 0, unassigned: 0, total: 0 } as Record<string, number>);

  const data = [
    { name: 'Bucket 1: Cash', value: totals.cash, color: 'hsl(var(--chart-3))', type: 'cash' },
    { name: 'Bucket 2: Income', value: totals.income, color: 'hsl(var(--chart-2))', type: 'income' },
    { name: 'Bucket 3: Growth', value: totals.growth, color: 'hsl(var(--chart-1))', type: 'growth' },
  ].filter(d => d.value > 0);

  if (totals.unassigned > 0) {
    data.push({ name: 'Unassigned', value: totals.unassigned, color: 'hsl(var(--muted-foreground))', type: 'unassigned' });
  }

  // Health Check Logic
  const yearlySpend = (scenario?.profile.monthlySpending || 0) * 12;
  const cashYears = yearlySpend > 0 ? totals.cash / yearlySpend : 0;
  const incomeYears = yearlySpend > 0 ? totals.income / yearlySpend : 0;

  const targetCashYears = scenario?.bucketConfig.cashTargetYears || 2;
  const targetIncomeYears = scenario?.bucketConfig.incomeTargetYears || 5;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Chart Section */}
        <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle className="font-serif">Current Allocation</CardTitle>
                <CardDescription>
                    Total Portfolio Value: <span className="font-mono font-bold text-primary">${totals.total.toLocaleString()}</span>
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

        {/* Health Stats Section */}
        <Card className="md:col-span-1 bg-muted/30 border-none shadow-none">
            <CardHeader>
                <CardTitle className="text-lg font-serif">Bucket Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                
                {/* Bucket 1 Health */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium text-chart-3-foreground">Bucket 1 (Cash)</span>
                        <span className={cn(
                            "font-mono font-bold",
                            cashYears >= targetCashYears ? "text-chart-1" : "text-destructive"
                        )}>
                            {cashYears.toFixed(1)} Years
                        </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-chart-3 transition-all duration-500" 
                            style={{ width: `${Math.min((cashYears / targetCashYears) * 100, 100)}%` }} 
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">Target: {targetCashYears} Years of spending</p>
                </div>

                {/* Bucket 2 Health */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium text-chart-2-foreground">Bucket 2 (Income)</span>
                        <span className={cn(
                            "font-mono font-bold",
                            incomeYears >= targetIncomeYears ? "text-chart-1" : "text-yellow-600"
                        )}>
                            {incomeYears.toFixed(1)} Years
                        </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-chart-2 transition-all duration-500" 
                            style={{ width: `${Math.min((incomeYears / targetIncomeYears) * 100, 100)}%` }} 
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">Target: {targetIncomeYears} Years of spending</p>
                </div>

                <div className="pt-4 border-t">
                    <div className="bg-background p-3 rounded-lg border shadow-sm">
                        <p className="text-xs font-semibold text-primary mb-1">Rebalancing Suggestion</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {cashYears < targetCashYears 
                                ? "Cash bucket is below target. Consider selling Bucket 3 (Growth) assets if market is up, or Bucket 2 (Income) if needed."
                                : "Cash bucket is healthy. Excess can be reinvested into Growth or Income."
                            }
                        </p>
                    </div>
                </div>

            </CardContent>
        </Card>
    </div>
  );
}
