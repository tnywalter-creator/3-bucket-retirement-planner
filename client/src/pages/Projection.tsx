import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { ProjectionChart } from '@/components/ProjectionChart';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { FlaskConical, Wallet } from 'lucide-react';

export default function ProjectionPage() {
  const { activeScenarioId, scenarios, holdings } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);

  const totalHoldings = holdings.reduce((s, h) => s + h.quantity * h.currentPrice, 0);
  const bucketedHoldings = holdings
    .filter(h => h.bucket !== 'unassigned')
    .reduce((s, h) => s + h.quantity * h.currentPrice, 0);
  const hasUsableHoldings = bucketedHoldings > 0;

  const [useTargets, setUseTargets] = useState(!hasUsableHoldings);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground" data-testid="text-projection-title">Future Projection</h1>
            <p className="text-muted-foreground mt-1">
              Simulate portfolio longevity using the 3-bucket withdrawal sequence.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-1 self-start md:self-auto">
            <Button
              variant={!useTargets ? 'default' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setUseTargets(false)}
              disabled={!hasUsableHoldings}
              data-testid="button-mode-holdings"
            >
              <Wallet size={13} />
              My Holdings
              {!hasUsableHoldings && <span className="text-[10px] opacity-60">(none)</span>}
            </Button>
            <Button
              variant={useTargets ? 'default' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setUseTargets(true)}
              data-testid="button-mode-targets"
            >
              <FlaskConical size={13} />
              Target Portfolio
            </Button>
          </div>
        </div>

        {useTargets && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 md:p-4">
              <p className="text-sm font-semibold text-primary">Simulating with fully-funded target portfolio</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This uses the target bucket amounts ($
                {scenario ? Math.round((scenario.bucketConfig.cashTarget + scenario.bucketConfig.bridgeTarget + scenario.bucketConfig.growthTarget) / 1000) : 0}K total)
                as the starting portfolio — not your actual holdings.
                Switch to <strong>My Holdings</strong> once you've added and bucketed your positions.
              </p>
            </CardContent>
          </Card>
        )}

        {scenario && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
            <Card className="bg-muted/20 border-none">
              <CardContent className="p-3 md:p-4">
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Spending</p>
                <p className="text-base md:text-xl font-mono font-bold" data-testid="text-spending">${scenario.profile.monthlySpending.toLocaleString()}/mo</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/20 border-none">
              <CardContent className="p-3 md:p-4">
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Withdrawal</p>
                <p className="text-base md:text-xl font-mono font-bold" data-testid="text-rate">{scenario.bucketConfig.withdrawalRate}%</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/20 border-none">
              <CardContent className="p-3 md:p-4">
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Age Now</p>
                <p className="text-base md:text-xl font-mono font-bold" data-testid="text-current-age">{scenario.profile.currentAge}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/20 border-none">
              <CardContent className="p-3 md:p-4">
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Retire At</p>
                <p className="text-base md:text-xl font-mono font-bold" data-testid="text-retirement-age">{scenario.profile.retirementAge ?? scenario.profile.currentAge}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/20 border-none">
              <CardContent className="p-3 md:p-4">
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Plan To</p>
                <p className="text-base md:text-xl font-mono font-bold" data-testid="text-life-expectancy">{scenario.profile.lifeExpectancy}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <ProjectionChart useTargets={useTargets} />
      </div>
    </Layout>
  );
}
