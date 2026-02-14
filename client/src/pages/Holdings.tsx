import { Layout } from '@/components/Layout';
import { HoldingsTable } from '@/components/HoldingsTable';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info, RotateCcw } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function HoldingsPage() {
  const { resetToDefaults } = useStore();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground">Holdings & Accounts</h1>
                <p className="text-muted-foreground mt-1">
                    Manage your investment accounts and individual positions.
                </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={resetToDefaults}
              className="gap-2 text-muted-foreground"
            >
              <RotateCcw size={14} />
              Reset All Data
            </Button>
        </div>

        <HoldingsTable />

        <Card className="bg-muted/50 border-dashed">
            <CardContent className="flex items-start gap-4 p-6">
                <Info className="text-primary mt-1 shrink-0" />
                <div className="space-y-1">
                    <h3 className="font-semibold text-foreground">Why enter cost basis?</h3>
                    <p className="text-sm text-muted-foreground">
                        While optional, entering your cost basis helps us estimate potential tax liabilities when you sell assets from your taxable accounts. For tax-deferred accounts (IRA, 401k), cost basis does not impact withdrawal taxes.
                    </p>
                </div>
            </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
