import { useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { BucketVisualizer } from '@/components/BucketVisualizer';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Clock, ArrowRight, ArrowUp, ArrowDown, Check } from 'lucide-react';
import { calculateRebalancing } from '@/lib/rebalance';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Bound a numeric input to a sane range.
const clamp = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;

export default function BucketsPage() {
  const { activeScenarioId, scenarios, updateBucketConfig, holdings } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);
  
  if (!scenario) return null;

  const bc = scenario.bucketConfig;

  const rebalance = useMemo(() => {
    return calculateRebalancing(holdings, bc);
  }, [holdings, bc]);

  const unassignedValue = holdings.filter(h => h.bucket === 'unassigned').reduce((s, h) => s + h.quantity * h.currentPrice, 0);

  return (
    <Layout>
      <div className="space-y-8">
        <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground" data-testid="text-bucket-title">Bucket Strategy</h1>
            <p className="text-muted-foreground mt-1">
                3-bucket allocation: Cash Reserve, Bridge, and Long-Term Growth.
            </p>
        </div>

        <BucketVisualizer />

        <ErrorBoundary fallbackTitle="Rebalancing Error">
          <Card data-testid="card-rebalancing">
            <CardHeader>
              <CardTitle className="font-serif">Rebalancing Dashboard</CardTitle>
              <CardDescription>How your current allocation compares to targets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {rebalance.bucketSummary.map(b => {
                  const pct = Math.min(b.percentOfTarget, 150);
                  return (
                    <div key={b.bucket} className="p-4 rounded-lg border bg-muted/10" data-testid={`rebalance-${b.bucket}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-sm">{b.label}</p>
                        {b.action === 'on-target' && <span className="text-xs text-primary flex items-center gap-1"><Check size={12} /> On target</span>}
                        {b.action === 'add' && <span className="text-xs text-destructive flex items-center gap-1"><ArrowUp size={12} /> Under</span>}
                        {b.action === 'reduce' && <span className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDown size={12} /> Over</span>}
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Current</span>
                          <span className="font-mono font-semibold">${(b.currentValue / 1000).toFixed(0)}K</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Target</span>
                          <span className="font-mono font-semibold">${(b.targetValue / 1000).toFixed(0)}K</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Difference</span>
                          <span className={`font-mono font-semibold ${b.difference >= 0 ? 'text-primary' : 'text-destructive'}`}>
                            {b.difference >= 0 ? '+' : ''}{(b.difference / 1000).toFixed(0)}K
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${b.action === 'on-target' ? 'bg-primary' : b.action === 'add' ? 'bg-destructive' : 'bg-muted-foreground'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 text-right">{b.percentOfTarget.toFixed(0)}% of target</p>
                    </div>
                  );
                })}
              </div>
              {unassignedValue > 0 && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30 text-xs">
                  <p className="font-semibold text-destructive">
                    ${(unassignedValue / 1000).toFixed(0)}K in unassigned holdings
                  </p>
                  <p className="text-muted-foreground mt-1">Assign holdings to buckets on the Holdings page for accurate tracking.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </ErrorBoundary>

        <Card data-testid="card-withdrawal-sequence">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2"><Clock size={18} /> Withdrawal Sequence</CardTitle>
            <CardDescription>How you draw down your portfolio over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border-2 border-chart-3/30 bg-chart-3/5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-chart-3 text-white flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <p className="font-semibold text-sm">Cash Reserve</p>
                    <p className="text-[10px] text-muted-foreground">Years 1-{bc.cashTargetYears}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Spend first. HYSA at {bc.cashReturn}%. Net monthly draw ~${(scenario.profile.monthlySpending * (1 - bc.cashReturn / 100 / 12)).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.</p>
                <p className="text-xs font-mono font-bold mt-2 text-chart-3">${(bc.cashTarget / 1000).toFixed(0)}K target</p>
              </div>

              <div className="p-4 rounded-lg border-2 border-chart-2/30 bg-chart-2/5 relative">
                <div className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <ArrowRight size={16} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-chart-2 text-white flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <p className="font-semibold text-sm">Bridge</p>
                    <p className="text-[10px] text-muted-foreground">Years {bc.cashTargetYears + 1}-{bc.cashTargetYears + bc.bridgeTargetYears}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Moderate growth at {bc.bridgeReturn}%. Cap gains tax rate (0-15%).</p>
                <p className="text-xs font-mono font-bold mt-2 text-chart-2">${(bc.bridgeTarget / 1000).toFixed(0)}K target</p>
              </div>

              <div className="p-4 rounded-lg border-2 border-chart-1/30 bg-chart-1/5 relative">
                <div className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <ArrowRight size={16} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-chart-1 text-white flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <p className="font-semibold text-sm">Growth</p>
                    <p className="text-[10px] text-muted-foreground">Year {bc.cashTargetYears + bc.bridgeTargetYears + 1}+</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Aggressive at {bc.growthReturn}%. Don't touch. Remainder of total portfolio need.</p>
                <p className="text-xs font-mono font-bold mt-2 text-chart-1">${(bc.growthTarget / 1000000).toFixed(2)}M target</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle className="font-serif">Target Configuration</CardTitle>
                    <CardDescription>Set dollar targets and duration for each bucket.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label>B1 Cash Reserve Duration</Label>
                            <span className="font-mono text-sm">{bc.cashTargetYears} yrs → ${(scenario.profile.monthlySpending * 12 * bc.cashTargetYears / 1000).toFixed(0)}K</span>
                        </div>
                        <Slider min={1} max={5} step={1} value={[bc.cashTargetYears]} onValueChange={(v) => updateBucketConfig({ cashTargetYears: v[0] })} data-testid="slider-cash-years" />
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label>B2 Bridge Duration</Label>
                            <span className="font-mono text-sm">{bc.bridgeTargetYears} yrs → ${(scenario.profile.monthlySpending * 12 * bc.bridgeTargetYears / 1000).toFixed(0)}K</span>
                        </div>
                        <Slider min={3} max={10} step={1} value={[bc.bridgeTargetYears]} onValueChange={(v) => updateBucketConfig({ bridgeTargetYears: v[0] })} data-testid="slider-bridge-years" />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        <Label>Withdrawal Rate %</Label>
                        <Input type="number" step="0.25" min={1} max={15} value={bc.withdrawalRate} onChange={(e) => updateBucketConfig({ withdrawalRate: clamp(Number(e.target.value), 1, 15) })} data-testid="input-withdrawal-rate" />
                        <p className="text-[10px] text-muted-foreground">Annual withdrawal as % of portfolio. At {bc.withdrawalRate}%, ${scenario.profile.monthlySpending.toLocaleString()}/mo needs a ${((scenario.profile.monthlySpending * 12) / (bc.withdrawalRate / 100) / 1000000).toFixed(2)}M portfolio. B3 = total needed minus B1 and B2.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">B1 Target $</Label>
                        <Input type="number" min={0} max={50000000} value={bc.cashTarget} onChange={(e) => updateBucketConfig({ cashTarget: clamp(Number(e.target.value), 0, 50000000) })} data-testid="input-cash-target" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">B2 Target $</Label>
                        <Input type="number" min={0} max={50000000} value={bc.bridgeTarget} onChange={(e) => updateBucketConfig({ bridgeTarget: clamp(Number(e.target.value), 0, 50000000) })} data-testid="input-bridge-target" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">B3 Target $</Label>
                        <Input type="number" min={0} max={50000000} value={bc.growthTarget} onChange={(e) => updateBucketConfig({ growthTarget: clamp(Number(e.target.value), 0, 50000000) })} data-testid="input-growth-target" />
                      </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-serif">Return Assumptions</CardTitle>
                    <CardDescription>Expected annual returns for projection (Nominal).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Cash Return %</Label>
                            <Input type="number" step="0.25" min={0} max={20} value={bc.cashReturn} onChange={(e) => updateBucketConfig({ cashReturn: clamp(Number(e.target.value), 0, 20) })} data-testid="input-cash-return" />
                            <p className="text-[10px] text-muted-foreground">HYSA / Money Market</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Bridge Return %</Label>
                            <Input type="number" step="0.25" min={0} max={25} value={bc.bridgeReturn} onChange={(e) => updateBucketConfig({ bridgeReturn: clamp(Number(e.target.value), 0, 25) })} data-testid="input-bridge-return" />
                            <p className="text-[10px] text-muted-foreground">Diversified mix</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Growth Return %</Label>
                            <Input type="number" step="0.25" min={0} max={30} value={bc.growthReturn} onChange={(e) => updateBucketConfig({ growthReturn: clamp(Number(e.target.value), 0, 30) })} data-testid="input-growth-return" />
                            <p className="text-[10px] text-muted-foreground">Stocks / Aggressive</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Inflation %</Label>
                            <Input type="number" disabled value={scenario.profile.inflationRate} className="bg-muted" />
                             <p className="text-[10px] text-muted-foreground">Edit in Settings</p>
                        </div>
                     </div>
                     <Separator />
                     <div>
                       <p className="text-xs font-semibold text-primary mb-3">B2 Bridge Target Allocation</p>
                       <div className="grid grid-cols-3 gap-2 text-[11px]">
                         <div className="p-2 bg-muted/30 rounded text-center"><span className="font-bold">30%</span><br/>US Large Cap<br/><span className="text-muted-foreground">VOO/VTI</span></div>
                         <div className="p-2 bg-muted/30 rounded text-center"><span className="font-bold">20%</span><br/>Growth<br/><span className="text-muted-foreground">VONG/VUG</span></div>
                         <div className="p-2 bg-muted/30 rounded text-center"><span className="font-bold">15%</span><br/>International<br/><span className="text-muted-foreground">VXUS</span></div>
                         <div className="p-2 bg-muted/30 rounded text-center"><span className="font-bold">20%</span><br/>Bonds<br/><span className="text-muted-foreground">BND/SCHZ</span></div>
                         <div className="p-2 bg-muted/30 rounded text-center"><span className="font-bold">10%</span><br/>Alternatives<br/><span className="text-muted-foreground">IAU/VNQ</span></div>
                         <div className="p-2 bg-muted/30 rounded text-center"><span className="font-bold">5%</span><br/>Crypto<br/><span className="text-muted-foreground">IBIT</span></div>
                       </div>
                     </div>
                     <div>
                       <p className="text-xs font-semibold text-primary mb-3">B3 Growth Target Allocation</p>
                       <div className="grid grid-cols-3 gap-2 text-[11px]">
                         <div className="p-2 bg-muted/30 rounded text-center"><span className="font-bold">35%</span><br/>US Total Mkt<br/><span className="text-muted-foreground">VOO</span></div>
                         <div className="p-2 bg-muted/30 rounded text-center"><span className="font-bold">25%</span><br/>US Growth<br/><span className="text-muted-foreground">GOOG,TSLA</span></div>
                         <div className="p-2 bg-muted/30 rounded text-center"><span className="font-bold">20%</span><br/>International<br/><span className="text-muted-foreground">VXUS</span></div>
                         <div className="p-2 bg-muted/30 rounded text-center"><span className="font-bold">10%</span><br/>Small/Mid<br/><span className="text-muted-foreground">VO, VXF</span></div>
                         <div className="p-2 bg-muted/30 rounded text-center"><span className="font-bold">10%</span><br/>Crypto<br/><span className="text-muted-foreground">IBIT</span></div>
                       </div>
                     </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </Layout>
  );
}
