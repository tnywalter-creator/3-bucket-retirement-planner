import { Layout } from '@/components/Layout';
import { BucketVisualizer } from '@/components/BucketVisualizer';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function BucketsPage() {
  const { activeScenarioId, scenarios, updateBucketConfig } = useStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);
  
  if (!scenario) return null;

  return (
    <Layout>
      <div className="space-y-8">
        <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground">Bucket Strategy</h1>
            <p className="text-muted-foreground mt-1">
                Visualize and optimize your 3-bucket allocation strategy.
            </p>
        </div>

        <BucketVisualizer />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Strategy Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="font-serif">Strategy Configuration</CardTitle>
                    <CardDescription>Adjust your target duration and expected returns.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label>Bucket 1 (Cash) Target</Label>
                            <span className="font-mono text-sm">{scenario.bucketConfig.cashTargetYears} Years</span>
                        </div>
                        <Slider 
                            min={0.5} max={5} step={0.5} 
                            value={[scenario.bucketConfig.cashTargetYears]} 
                            onValueChange={(v) => updateBucketConfig({ cashTargetYears: v[0] })}
                        />
                        <p className="text-xs text-muted-foreground">How many years of spending to keep in safe, liquid cash.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label>Bucket 2 (Income) Target</Label>
                            <span className="font-mono text-sm">{scenario.bucketConfig.incomeTargetYears} Years</span>
                        </div>
                        <Slider 
                            min={2} max={10} step={1} 
                            value={[scenario.bucketConfig.incomeTargetYears]} 
                            onValueChange={(v) => updateBucketConfig({ incomeTargetYears: v[0] })}
                        />
                         <p className="text-xs text-muted-foreground">Years of spending to keep in bonds/fixed income to ride out market downturns.</p>
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
                            <Input 
                                type="number" 
                                value={scenario.bucketConfig.cashReturn} 
                                onChange={(e) => updateBucketConfig({ cashReturn: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Income Return %</Label>
                            <Input 
                                type="number" 
                                value={scenario.bucketConfig.incomeReturn} 
                                onChange={(e) => updateBucketConfig({ incomeReturn: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Growth Return %</Label>
                            <Input 
                                type="number" 
                                value={scenario.bucketConfig.growthReturn} 
                                onChange={(e) => updateBucketConfig({ growthReturn: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Inflation %</Label>
                            <Input 
                                type="number" 
                                disabled
                                value={scenario.profile.inflationRate} 
                                className="bg-muted"
                            />
                             <p className="text-[10px] text-muted-foreground">Edit in Scenarios</p>
                        </div>
                     </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </Layout>
  );
}
