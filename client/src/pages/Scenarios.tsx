import { Layout } from '@/components/Layout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Users, Banknote, CalendarClock, Wallet } from 'lucide-react';

export default function ScenariosPage() {
  const { activeScenarioId, scenarios, updateUserProfile } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);

  if (!scenario) return null;

  return (
    <Layout>
      <div className="space-y-8">
        <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
                Configure the variables that drive your retirement plan.
            </p>
        </div>

        {/* Demographics Section */}
        <section className="space-y-4">
             <div className="flex items-center gap-2 text-primary border-b pb-2">
                <Users size={20} />
                <h2 className="text-lg font-semibold">Household Profile</h2>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Primary Earner Card */}
                <Card className="bg-background">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium text-muted-foreground">Primary Earner</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Current Age</Label>
                                <Input 
                                    type="number" 
                                    value={scenario.profile.currentAge}
                                    onChange={(e) => updateUserProfile({ currentAge: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Retirement Age</Label>
                                <Input 
                                    type="number" 
                                    value={scenario.profile.retirementAge}
                                    onChange={(e) => updateUserProfile({ retirementAge: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Life Expectancy</Label>
                            <Input 
                                type="number" 
                                value={scenario.profile.lifeExpectancy}
                                onChange={(e) => updateUserProfile({ lifeExpectancy: Number(e.target.value) })}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Spouse Card */}
                <Card className="bg-background">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium text-muted-foreground">Spouse / Partner</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Current Age</Label>
                             <Input 
                                type="number" 
                                value={scenario.profile.spouseAge || ''}
                                placeholder="Optional"
                                onChange={(e) => updateUserProfile({ spouseAge: e.target.value ? Number(e.target.value) : undefined })}
                            />
                        </div>
                        <div className="p-3 bg-muted/30 rounded-md text-xs text-muted-foreground">
                            Adding spouse details helps coordinate Social Security claiming strategies and joint longevity planning.
                        </div>
                    </CardContent>
                </Card>
             </div>
        </section>

        {/* Financials Section */}
        <section className="space-y-4">
            <div className="flex items-center gap-2 text-primary border-b pb-2">
                <Banknote size={20} />
                <h2 className="text-lg font-semibold">Income & Spending</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Spending Card */}
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
                                <Input 
                                    type="number" 
                                    className="pl-7 text-lg font-mono font-bold"
                                    value={scenario.profile.monthlySpending}
                                    onChange={(e) => updateUserProfile({ monthlySpending: Number(e.target.value) })}
                                />
                             </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            This amount will be adjusted for inflation annually in projections.
                        </p>
                    </CardContent>
                </Card>

                {/* Income Sources Card */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base font-serif">Guaranteed Income Sources</CardTitle>
                        <CardDescription>Social Security, Pensions, Annuities</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            
                            {/* Primary SS */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                    <CalendarClock size={16}/> Primary Social Security
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Claim Age</Label>
                                        <Input 
                                            type="number" 
                                            value={scenario.profile.socialSecurityAge}
                                            onChange={(e) => updateUserProfile({ socialSecurityAge: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Monthly Amount</Label>
                                        <Input 
                                            type="number" 
                                            value={scenario.profile.socialSecurityAmount}
                                            onChange={(e) => updateUserProfile({ socialSecurityAmount: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Spouse SS */}
                            <div className="space-y-4 border-l pl-0 md:pl-8 border-dashed md:border-solid">
                                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                    <CalendarClock size={16}/> Spouse Social Security
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Claim Age</Label>
                                        <Input 
                                            type="number" 
                                            placeholder="67"
                                            value={scenario.profile.spouseSocialSecurityAge || ''}
                                            onChange={(e) => updateUserProfile({ spouseSocialSecurityAge: e.target.value ? Number(e.target.value) : undefined })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Monthly Amount</Label>
                                        <Input 
                                            type="number" 
                                            placeholder="0"
                                            value={scenario.profile.spouseSocialSecurityAmount || ''}
                                            onChange={(e) => updateUserProfile({ spouseSocialSecurityAmount: e.target.value ? Number(e.target.value) : undefined })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Other Income (Spanning Full Width) */}
                            <div className="md:col-span-2 pt-4 border-t">
                                <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-3">
                                    <Wallet size={16}/> Other Income
                                </div>
                                <div className="space-y-2 max-w-[50%]">
                                    <Label className="text-xs">Pension / Annuity (Monthly)</Label>
                                    <Input 
                                        type="number" 
                                        value={scenario.profile.otherIncome}
                                        onChange={(e) => updateUserProfile({ otherIncome: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
      </div>
    </Layout>
  );
}
