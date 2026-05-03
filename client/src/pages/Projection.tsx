import { Layout } from '@/components/Layout';
import { ProjectionChart } from '@/components/ProjectionChart';
import { Card, CardContent } from '@/components/ui/card';
import { useStore } from '@/lib/store';

export default function ProjectionPage() {
    const { activeScenarioId, scenarios } = useStore();
    const scenario = scenarios.find(s => s.id === activeScenarioId);
    
  return (
    <Layout>
      <div className="space-y-6">
        <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground" data-testid="text-projection-title">Future Projection</h1>
            <p className="text-muted-foreground mt-1">
                Simulate portfolio longevity using the 3-bucket withdrawal sequence.
            </p>
        </div>

        {scenario && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4 mb-4">
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

        <ProjectionChart />
      </div>
    </Layout>
  );
}
