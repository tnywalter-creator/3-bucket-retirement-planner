import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { runProjection } from '@/lib/engine';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart, Line } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function ProjectionChart() {
  const { activeScenarioId, scenarios, holdings } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);

  const data = useMemo(() => {
    if (!scenario) return [];
    return runProjection(scenario.profile, scenario.bucketConfig, holdings);
  }, [scenario, holdings]);

  if (!scenario || data.length === 0) return <div>No data to project</div>;

  return (
    <div className="space-y-8">
        <Card>
            <CardHeader>
                <CardTitle className="font-serif">Portfolio Balance Projection</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px] md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
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
                        <Area type="monotone" dataKey="endBalanceGrowth" stackId="1" stroke="hsl(var(--chart-1))" fill="url(#colorGrowth)" name="Bucket 3 (Growth)" />
                        <Area type="monotone" dataKey="endBalanceIncome" stackId="1" stroke="hsl(var(--chart-2))" fill="url(#colorIncome)" name="Bucket 2 (Income)" />
                        <Area type="monotone" dataKey="endBalanceCash" stackId="1" stroke="hsl(var(--chart-3))" fill="url(#colorCash)" name="Bucket 1 (Cash)" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-serif text-lg">Income vs Spending</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px] md:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data}>
                            <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : `${Math.round(val/1000)}k`} tick={{ fontSize: 11 }} width={45}/>
                            <Tooltip formatter={(value: number) => `$${Math.round(value).toLocaleString()}`} />
                            <Legend />
                            <Bar dataKey="spendingNeed" fill="hsl(var(--destructive))" name="Spending Need" opacity={0.6} />
                            <Line type="monotone" dataKey="income" stroke="hsl(var(--primary))" strokeWidth={2} name="Guaranteed Income" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-serif text-lg">Withdrawals Required</CardTitle>
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
                            <Bar dataKey="withdrawalNeeded" fill="hsl(var(--sidebar-accent))" name="Portfolio Withdrawal" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
