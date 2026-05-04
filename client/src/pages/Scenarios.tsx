import { useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Users, Banknote, CalendarClock, Wallet, FileText, Plus, Copy, Trash2, Check, X, Receipt } from 'lucide-react';
import { runProjection } from '@/lib/engine';
import { toast } from 'sonner';

// Bound a numeric input to a sane range. Used everywhere the user types a number.
const clamp = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;

export default function ScenariosPage() {
  const { activeScenarioId, scenarios, updateUserProfile, addScenario, duplicateScenario, removeScenario, renameScenario, setActiveScenario, holdings, accounts } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  // Memoize projection per scenario so typing in one card doesn't re-run all of them.
  const projectionsByScenarioId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof runProjection>>();
    for (const s of scenarios) {
      map.set(s.id, runProjection(s.profile, s.bucketConfig, holdings, { accounts }));
    }
    return map;
  }, [scenarios, holdings]);

  if (!scenario) return null;

  const handleAddScenario = () => {
    const name = `Scenario ${scenarios.length + 1}`;
    addScenario(name);
    toast.success(`Created "${name}"`);
  };

  const handleDuplicate = (id: string) => {
    const source = scenarios.find(s => s.id === id);
    if (!source) return;
    duplicateScenario(id, `${source.name} (Copy)`);
    toast.success('Scenario duplicated');
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground" data-testid="text-settings-title">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure the variables that drive your retirement plan.</p>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2 text-primary">
              <FileText size={20} />
              <h2 className="text-lg font-semibold">Scenarios</h2>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddScenario} data-testid="button-add-scenario">
              <Plus size={14} className="mr-1" /> New Scenario
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {scenarios.map(s => {
              const proj = projectionsByScenarioId.get(s.id) ?? [];
              const finalBal = proj[proj.length - 1]?.totalPortfolio || 0;
              const depletionYear = proj.find(d => d.totalPortfolio <= 0);
              const isActive = s.id === activeScenarioId;

              return (
                <Card
                  key={s.id}
                  className={`cursor-pointer transition-all ${isActive ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'}`}
                  onClick={() => setActiveScenario(s.id)}
                  data-testid={`card-scenario-${s.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      {editingName === s.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            className="h-7 text-sm w-32"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); renameScenario(s.id, tempName); setEditingName(null); }}>
                            <Check size={12} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditingName(null); }}>
                            <X size={12} />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-sm font-semibold hover:text-primary text-left"
                          onClick={(e) => { e.stopPropagation(); setEditingName(s.id); setTempName(s.name); }}
                        >
                          {s.name} {isActive && <span className="text-primary text-xs">(active)</span>}
                        </button>
                      )}
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDuplicate(s.id); }} data-testid={`button-duplicate-${s.id}`}>
                          <Copy size={12} />
                        </Button>
                        {scenarios.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); removeScenario(s.id); toast.success('Scenario removed'); }} data-testid={`button-delete-${s.id}`}>
                            <Trash2 size={12} />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Spending</p>
                        <p className="font-mono font-semibold">${(s.profile.monthlySpending/1000).toFixed(0)}k/mo</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Final Balance</p>
                        <p className={`font-mono font-semibold ${finalBal <= 0 ? 'text-destructive' : 'text-primary'}`}>
                          {finalBal >= 1000000 ? `$${(finalBal/1000000).toFixed(1)}M` : finalBal > 0 ? `$${(finalBal/1000).toFixed(0)}K` : '$0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Lasts To</p>
                        <p className={`font-mono font-semibold ${depletionYear ? 'text-destructive' : 'text-primary'}`}>
                          {depletionYear ? `Age ${depletionYear.age}` : `Age ${s.profile.lifeExpectancy}+`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
           <div className="flex items-center gap-2 text-primary border-b pb-2">
              <Users size={20} />
              <h2 className="text-lg font-semibold">Household Profile</h2>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-background">
                  <CardHeader className="pb-3">
                      <CardTitle className="text-base font-medium text-muted-foreground">Primary Earner</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                       <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                              <Label className="text-xs">Current Age</Label>
                              <Input type="number" min={18} max={100} value={scenario.profile.currentAge} onChange={(e) => updateUserProfile({ currentAge: clamp(Number(e.target.value), 18, 100) })} data-testid="input-current-age" />
                          </div>
                          <div className="space-y-2">
                              <Label className="text-xs">Retirement Age</Label>
                              <Input type="number" min={18} max={100} value={scenario.profile.retirementAge} onChange={(e) => updateUserProfile({ retirementAge: clamp(Number(e.target.value), 18, 100) })} data-testid="input-retirement-age" />
                          </div>
                          <div className="space-y-2">
                              <Label className="text-xs">Plan To Age</Label>
                              <Input type="number" min={50} max={120} value={scenario.profile.lifeExpectancy} onChange={(e) => updateUserProfile({ lifeExpectancy: clamp(Number(e.target.value), 50, 120) })} data-testid="input-life-expectancy" />
                          </div>
                      </div>
                  </CardContent>
              </Card>

              <Card className="bg-background">
                  <CardHeader className="pb-3">
                      <CardTitle className="text-base font-medium text-muted-foreground">
                        Spouse / Partner {scenario.profile.spouseName ? `(${scenario.profile.spouseName})` : ''}
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-xs">Name</Label>
                            <Input value={scenario.profile.spouseName || ''} placeholder="Optional" onChange={(e) => updateUserProfile({ spouseName: e.target.value || undefined })} data-testid="input-spouse-name" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Current Age</Label>
                             <Input type="number" min={18} max={100} value={scenario.profile.spouseAge || ''} placeholder="Optional" onChange={(e) => updateUserProfile({ spouseAge: e.target.value ? clamp(Number(e.target.value), 18, 100) : undefined })} data-testid="input-spouse-age" />
                        </div>
                      </div>
                      <div className="space-y-2">
                          <Label className="text-xs">Spouse Monthly Income</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                            <Input type="number" className="pl-7" min={0} max={100000} value={scenario.profile.spouseIncome || ''} placeholder="0" onChange={(e) => updateUserProfile({ spouseIncome: e.target.value ? clamp(Number(e.target.value), 0, 100000) : undefined })} data-testid="input-spouse-income" />
                          </div>
                          <p className="text-[10px] text-muted-foreground">Ongoing income (e.g. $3,333/mo = $40K/year)</p>
                      </div>
                  </CardContent>
              </Card>
           </div>
        </section>

        <section className="space-y-4">
            <div className="flex items-center gap-2 text-primary border-b pb-2">
                <Banknote size={20} />
                <h2 className="text-lg font-semibold">Income & Spending</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 border-primary/20 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-serif">Spending Needs</CardTitle>
                        <CardDescription>Target monthly budget (today's dollars)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                             <Label className="text-lg font-semibold text-primary">Monthly Budget</Label>
                             <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                <Input type="number" className="pl-7 text-lg font-mono font-bold" min={0} max={1000000} value={scenario.profile.monthlySpending} onChange={(e) => updateUserProfile({ monthlySpending: clamp(Number(e.target.value), 0, 1000000) })} data-testid="input-monthly-spending" />
                             </div>
                        </div>
                        <div className="space-y-2">
                             <Label className="text-xs">Inflation Rate %</Label>
                             <Input type="number" step="0.5" min={-5} max={20} value={scenario.profile.inflationRate} onChange={(e) => updateUserProfile({ inflationRate: clamp(Number(e.target.value), -5, 20) })} data-testid="input-inflation-rate" />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Adjusted for inflation annually. At {scenario.bucketConfig.withdrawalRate}% withdrawal rate, ${scenario.profile.monthlySpending.toLocaleString()}/mo needs a ${((scenario.profile.monthlySpending * 12) / (scenario.bucketConfig.withdrawalRate / 100) / 1000000).toFixed(2)}M portfolio.
                        </p>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base font-serif">Guaranteed Income Sources</CardTitle>
                        <CardDescription>Social Security, Pensions, Annuities</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                    <CalendarClock size={16}/> Primary Social Security
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Claim Age</Label>
                                        <Input type="number" min={62} max={70} value={scenario.profile.socialSecurityAge} onChange={(e) => updateUserProfile({ socialSecurityAge: clamp(Number(e.target.value), 62, 70) })} data-testid="input-ss-age" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Monthly Amount</Label>
                                        <Input type="number" min={0} max={100000} value={scenario.profile.socialSecurityAmount} onChange={(e) => updateUserProfile({ socialSecurityAmount: clamp(Number(e.target.value), 0, 100000) })} data-testid="input-ss-amount" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 border-l pl-0 md:pl-8 border-dashed md:border-solid">
                                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                    <CalendarClock size={16}/> Spouse Social Security
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Claim Age</Label>
                                        <Input type="number" min={62} max={70} placeholder="67" value={scenario.profile.spouseSocialSecurityAge || ''} onChange={(e) => updateUserProfile({ spouseSocialSecurityAge: e.target.value ? clamp(Number(e.target.value), 62, 70) : undefined })} data-testid="input-spouse-ss-age" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Monthly Amount</Label>
                                        <Input type="number" min={0} max={100000} placeholder="0" value={scenario.profile.spouseSocialSecurityAmount || ''} onChange={(e) => updateUserProfile({ spouseSocialSecurityAmount: e.target.value ? clamp(Number(e.target.value), 0, 100000) : undefined })} data-testid="input-spouse-ss-amount" />
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2 pt-4 border-t">
                                <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-3">
                                    <Wallet size={16}/> Other Income
                                </div>
                                <div className="space-y-2 max-w-[50%]">
                                    <Label className="text-xs">Pension / Annuity (Monthly)</Label>
                                    <Input type="number" min={0} max={100000} value={scenario.profile.otherIncome} onChange={(e) => updateUserProfile({ otherIncome: clamp(Number(e.target.value), 0, 100000) })} data-testid="input-other-income" />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary border-b pb-2">
              <Receipt size={20} />
              <h2 className="text-lg font-semibold">Tax Rates</h2>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Federal Marginal %</Label>
                  <Input type="number" step="1" min={0} max={50} value={scenario.profile.taxConfig?.federalRate ?? 22} onChange={(e) => updateUserProfile({ taxConfig: { ...(scenario.profile.taxConfig || { federalRate: 22, stateRate: 5, capitalGainsRate: 15 }), federalRate: clamp(Number(e.target.value), 0, 50) } })} data-testid="input-federal-rate" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">State Rate %</Label>
                  <Input type="number" step="1" min={0} max={20} value={scenario.profile.taxConfig?.stateRate ?? 5} onChange={(e) => updateUserProfile({ taxConfig: { ...(scenario.profile.taxConfig || { federalRate: 22, stateRate: 5, capitalGainsRate: 15 }), stateRate: clamp(Number(e.target.value), 0, 20) } })} data-testid="input-state-rate" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Capital Gains %</Label>
                  <Input type="number" step="1" min={0} max={30} value={scenario.profile.taxConfig?.capitalGainsRate ?? 15} onChange={(e) => updateUserProfile({ taxConfig: { ...(scenario.profile.taxConfig || { federalRate: 22, stateRate: 5, capitalGainsRate: 15 }), capitalGainsRate: clamp(Number(e.target.value), 0, 30) } })} data-testid="input-capgains-rate" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">
                Used in projections: Cash phase = 0% tax, Bridge phase = capital gains rate, Growth phase = blended income tax rate.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary border-b pb-2">
              <FileText size={20} />
              <h2 className="text-lg font-semibold">Key Assumptions</h2>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between py-1.5 border-b border-dashed">
                    <span className="text-muted-foreground">Monthly Target</span>
                    <span className="font-mono font-semibold">${scenario.profile.monthlySpending.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-dashed">
                    <span className="text-muted-foreground">Withdrawal Rate</span>
                    <span className="font-mono font-semibold">{scenario.bucketConfig.withdrawalRate}%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-dashed">
                    <span className="text-muted-foreground">HYSA Rate (Cash)</span>
                    <span className="font-mono font-semibold">{scenario.bucketConfig.cashReturn}%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-dashed">
                    <span className="text-muted-foreground">Bridge Growth</span>
                    <span className="font-mono font-semibold">{scenario.bucketConfig.bridgeReturn}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between py-1.5 border-b border-dashed">
                    <span className="text-muted-foreground">Growth Return</span>
                    <span className="font-mono font-semibold">{scenario.bucketConfig.growthReturn}%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-dashed">
                    <span className="text-muted-foreground">Inflation</span>
                    <span className="font-mono font-semibold">{scenario.profile.inflationRate}%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-dashed">
                    <span className="text-muted-foreground">{scenario.profile.spouseName || 'Spouse'} Income</span>
                    <span className="font-mono font-semibold">${((scenario.profile.spouseIncome || 0) * 12).toLocaleString()}/yr</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-dashed">
                    <span className="text-muted-foreground">Home Equity (excluded)</span>
                    <span className="font-mono font-semibold text-muted-foreground">~$900K</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </Layout>
  );
}
