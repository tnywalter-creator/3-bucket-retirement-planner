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
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground">Future Projection</h1>
            <p className="text-muted-foreground mt-1">
                Simulate your portfolio longevity based on your 3-bucket parameters.
            </p>
        </div>

        {scenario && (
            <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4">
                <Card className="bg-muted/20 border-none">
                    <CardContent className="p-3 md:p-4">
                        <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Spending</p>
                        <p className="text-base md:text-xl font-mono font-bold">${(scenario.profile.monthlySpending/1000).toFixed(1)}k/mo</p>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border-none">
                    <CardContent className="p-3 md:p-4">
                        <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Retire At</p>
                        <p className="text-base md:text-xl font-mono font-bold">{scenario.profile.retirementAge}</p>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border-none">
                    <CardContent className="p-3 md:p-4">
                        <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Plan To</p>
                        <p className="text-base md:text-xl font-mono font-bold">{scenario.profile.lifeExpectancy}</p>
                    </CardContent>
                </Card>
            </div>
        )}

        <ProjectionChart />
      </div>
    </Layout>
  );
}
