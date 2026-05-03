import { useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { runProjection, compareSSClaimingAges } from '@/lib/engine';
import { calculateRebalancing } from '@/lib/rebalance';
import { Printer, Download } from 'lucide-react';

export default function ReportPage() {
  const { activeScenarioId, scenarios, holdings } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);

  const data = useMemo(() => {
    if (!scenario) return [];
    return runProjection(scenario.profile, scenario.bucketConfig, holdings);
  }, [scenario, holdings]);

  const rebalance = useMemo(() => {
    if (!scenario) return null;
    return calculateRebalancing(holdings, scenario.bucketConfig);
  }, [holdings, scenario]);

  const ssComparison = useMemo(() => {
    if (!scenario) return [];
    return compareSSClaimingAges(scenario.profile, scenario.bucketConfig, holdings);
  }, [scenario, holdings]);

  if (!scenario) return null;

  const depletionYear = data.find(d => d.totalPortfolio <= 0);
  const finalBalance = data[data.length - 1]?.totalPortfolio || 0;
  const totalPortfolio = holdings.reduce((s, h) => s + h.quantity * h.currentPrice, 0);
  const bc = scenario.bucketConfig;
  const profile = scenario.profile;

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const headers = ['Year', 'Age', 'Spending Need', 'Income', 'Withdrawal', 'Tax', 'Cash Balance', 'Bridge Balance', 'Growth Balance', 'Total Portfolio', 'Source'];
    const rows = data.map(d => [
      d.year, d.age,
      Math.round(d.spendingNeed), Math.round(d.income),
      Math.round(d.withdrawalNeeded), Math.round(d.taxOnWithdrawal),
      Math.round(d.endBalanceCash), Math.round(d.endBalanceBridge), Math.round(d.endBalanceGrowth),
      Math.round(d.totalPortfolio), d.withdrawalSource
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retirement-projection-${scenario.name.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6 print:space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold" data-testid="text-report-title">Retirement Plan Report</h1>
            <p className="text-muted-foreground mt-1">Printable summary for: {scenario.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
              <Download size={14} className="mr-1" /> Export CSV
            </Button>
            <Button size="sm" onClick={handlePrint} data-testid="button-print">
              <Printer size={14} className="mr-1" /> Print
            </Button>
          </div>
        </div>

        <div className="hidden print:block text-center border-b pb-4 mb-6">
          <h1 className="text-3xl font-serif font-bold">3-Bucket Retirement Plan</h1>
          <p className="text-sm text-muted-foreground mt-1">{scenario.name} - Generated {new Date().toLocaleDateString()}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Total Portfolio</p>
              <p className="text-lg font-mono font-bold">${(totalPortfolio / 1000000).toFixed(2)}M</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Monthly Spending</p>
              <p className="text-lg font-mono font-bold">${profile.monthlySpending.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Final Balance</p>
              <p className={`text-lg font-mono font-bold ${finalBalance > 0 ? 'text-primary' : 'text-destructive'}`}>
                {finalBalance >= 1000000 ? `$${(finalBalance/1000000).toFixed(1)}M` : finalBalance > 0 ? `$${(finalBalance/1000).toFixed(0)}K` : '$0'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Lasts Until</p>
              <p className={`text-lg font-mono font-bold ${depletionYear ? 'text-destructive' : 'text-primary'}`}>
                {depletionYear ? `Age ${depletionYear.age}` : `Age ${profile.lifeExpectancy}+`}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Household Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <div className="flex justify-between py-1 border-b border-dashed"><span className="text-muted-foreground">Age</span><span className="font-mono">{profile.currentAge}</span></div>
              <div className="flex justify-between py-1 border-b border-dashed"><span className="text-muted-foreground">Plan to age</span><span className="font-mono">{profile.lifeExpectancy}</span></div>
              <div className="flex justify-between py-1 border-b border-dashed"><span className="text-muted-foreground">Spouse</span><span className="font-mono">{profile.spouseName || 'N/A'} (age {profile.spouseAge || '?'})</span></div>
              <div className="flex justify-between py-1 border-b border-dashed"><span className="text-muted-foreground">Spouse income</span><span className="font-mono">${((profile.spouseIncome || 0) * 12).toLocaleString()}/yr</span></div>
              <div className="flex justify-between py-1 border-b border-dashed"><span className="text-muted-foreground">SS claim age</span><span className="font-mono">{profile.socialSecurityAge}</span></div>
              <div className="flex justify-between py-1 border-b border-dashed"><span className="text-muted-foreground">SS monthly</span><span className="font-mono">${profile.socialSecurityAmount.toLocaleString()}</span></div>
              <div className="flex justify-between py-1 border-b border-dashed"><span className="text-muted-foreground">Withdrawal rate</span><span className="font-mono">{bc.withdrawalRate}%</span></div>
              <div className="flex justify-between py-1 border-b border-dashed"><span className="text-muted-foreground">Inflation</span><span className="font-mono">{profile.inflationRate}%</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Bucket Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 border rounded-lg">
                <p className="font-semibold">B1: Cash Reserve</p>
                <p className="text-xs text-muted-foreground">Years 1-{bc.cashTargetYears} at {bc.cashReturn}%</p>
                <p className="font-mono font-bold mt-1">${(bc.cashTarget/1000).toFixed(0)}K target</p>
                {rebalance && <p className="text-xs mt-1">Current: ${(rebalance.bucketSummary[0].currentValue/1000).toFixed(0)}K ({rebalance.bucketSummary[0].percentOfTarget.toFixed(0)}%)</p>}
              </div>
              <div className="p-3 border rounded-lg">
                <p className="font-semibold">B2: Bridge</p>
                <p className="text-xs text-muted-foreground">Years {bc.cashTargetYears+1}-{bc.cashTargetYears+bc.bridgeTargetYears} at {bc.bridgeReturn}%</p>
                <p className="font-mono font-bold mt-1">${(bc.bridgeTarget/1000).toFixed(0)}K target</p>
                {rebalance && <p className="text-xs mt-1">Current: ${(rebalance.bucketSummary[1].currentValue/1000).toFixed(0)}K ({rebalance.bucketSummary[1].percentOfTarget.toFixed(0)}%)</p>}
              </div>
              <div className="p-3 border rounded-lg">
                <p className="font-semibold">B3: Growth</p>
                <p className="text-xs text-muted-foreground">Year {bc.cashTargetYears+bc.bridgeTargetYears+1}+ at {bc.growthReturn}%</p>
                <p className="font-mono font-bold mt-1">${(bc.growthTarget/1000000).toFixed(2)}M target</p>
                {rebalance && <p className="text-xs mt-1">Current: ${(rebalance.bucketSummary[2].currentValue/1000).toFixed(0)}K ({rebalance.bucketSummary[2].percentOfTarget.toFixed(0)}%)</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Social Security Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 text-sm">
              {ssComparison.map(ss => (
                <div key={ss.claimAge} className={`p-2 rounded border text-center ${ss.claimAge === profile.socialSecurityAge ? 'border-primary bg-primary/5' : ''}`}>
                  <p className="font-bold">Age {ss.claimAge}</p>
                  <p className="font-mono text-xs">${ss.monthlyBenefit.toLocaleString()}/mo</p>
                  <p className="font-mono text-xs">Lifetime: ${(ss.lifetimeTotal/1000000).toFixed(2)}M</p>
                  <p className={`font-mono text-xs font-semibold ${ss.portfolioAtEnd > 0 ? 'text-primary' : 'text-destructive'}`}>
                    End: {ss.portfolioAtEnd >= 1000000 ? `$${(ss.portfolioAtEnd/1000000).toFixed(1)}M` : ss.portfolioAtEnd > 0 ? `$${(ss.portfolioAtEnd/1000).toFixed(0)}K` : 'Depleted'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Year-by-Year Projection (First 15 Years)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 pr-2">Age</th>
                    <th className="text-right py-1.5 px-2">Spending</th>
                    <th className="text-right py-1.5 px-2">Income</th>
                    <th className="text-right py-1.5 px-2">Withdrawal</th>
                    <th className="text-right py-1.5 px-2">Cash</th>
                    <th className="text-right py-1.5 px-2">Bridge</th>
                    <th className="text-right py-1.5 px-2">Growth</th>
                    <th className="text-right py-1.5 pl-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 15).map(d => (
                    <tr key={d.age} className="border-b border-dashed">
                      <td className="py-1.5 pr-2 font-semibold">{d.age}</td>
                      <td className="text-right py-1.5 px-2 font-mono">${(d.spendingNeed/1000).toFixed(0)}K</td>
                      <td className="text-right py-1.5 px-2 font-mono">${(d.income/1000).toFixed(0)}K</td>
                      <td className="text-right py-1.5 px-2 font-mono">${(d.withdrawalNeeded/1000).toFixed(0)}K</td>
                      <td className="text-right py-1.5 px-2 font-mono">${(d.endBalanceCash/1000).toFixed(0)}K</td>
                      <td className="text-right py-1.5 px-2 font-mono">${(d.endBalanceBridge/1000).toFixed(0)}K</td>
                      <td className="text-right py-1.5 px-2 font-mono">${(d.endBalanceGrowth/1000).toFixed(0)}K</td>
                      <td className="text-right py-1.5 pl-2 font-mono font-semibold">${d.totalPortfolio >= 1000000 ? `${(d.totalPortfolio/1000000).toFixed(2)}M` : `${(d.totalPortfolio/1000).toFixed(0)}K`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <p className="text-[10px] text-center text-muted-foreground print:block">
          This report is for informational purposes only and does not constitute financial advice. 
          Generated by 3-Bucket Retirement Planner on {new Date().toLocaleDateString()}.
        </p>
      </div>
    </Layout>
  );
}
