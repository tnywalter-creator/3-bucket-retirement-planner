import { useState, useRef } from 'react';
import { useStore } from '@/lib/store';
import { BucketType, Holding } from '@/lib/types';
import { Trash2, RefreshCw, Download, Upload, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddHoldingDialog } from './AddHoldingDialog';
import { AddAccountDialog } from './AddAccountDialog';
import { exportHoldingsToCSV, downloadCSV, parseFile } from '@/lib/csvExport';
import { toast } from 'sonner';

function EditableCell({ 
  value, 
  onSave, 
  type = 'number',
  prefix = '',
}: { 
  value: number; 
  onSave: (val: number) => void;
  type?: 'number' | 'currency';
  prefix?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());

  const handleSave = () => {
    const num = parseFloat(editValue);
    if (!isNaN(num) && num >= 0) {
      onSave(num);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-24 text-right font-mono text-sm"
          autoFocus
        />
        <Button variant="ghost" size="icon" onClick={handleSave} className="h-6 w-6 text-green-600">
          <Check size={12} />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleCancel} className="h-6 w-6 text-red-500">
          <X size={12} />
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="font-mono text-right hover:bg-muted/50 px-2 py-1 rounded cursor-pointer transition-colors group flex items-center gap-1"
    >
      {prefix}{type === 'currency' ? value.toFixed(2) : value.toLocaleString()}
      <Pencil size={10} className="opacity-0 group-hover:opacity-50" />
    </button>
  );
}

export function HoldingsTable() {
  const { holdings, accounts, removeHolding, setBucket, refreshPrices, addHolding, updateHolding, addAccount } = useStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshPrices();
    setIsRefreshing(false);
    toast.success('Prices updated');
  };

  const handleExport = () => {
    const csv = exportHoldingsToCSV(holdings, accounts);
    downloadCSV(csv, `holdings-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Holdings exported to CSV');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Handle PDF files separately
    if (file.name.toLowerCase().endsWith('.pdf')) {
      await handlePDFImport(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const result = await parseFile(file, accounts);

    if (result.errors.length > 0) {
      toast.error(`Import had ${result.errors.length} issues`, {
        description: result.errors.slice(0, 3).join(', ')
      });
    }

    if (result.holdings.length === 0) {
      toast.error('No holdings found in file', {
        description: 'Check that your file has columns like Ticker/Symbol and Shares/Quantity'
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const accountMap = new Map<string, string>();
    for (const accName of result.newAccounts) {
      const newAcc = { name: accName, type: 'taxable' as const };
      addAccount(newAcc);
    }

    const updatedAccounts = useStore.getState().accounts;
    const updatedAccountByName = new Map(updatedAccounts.map(a => [a.name.toLowerCase(), a.id]));

    let imported = 0;
    for (const h of result.holdings) {
      if (h.ticker && h.quantity) {
        const accNameFromNotes = h.notes?.replace('account:', '').toLowerCase();
        const accountId = accNameFromNotes ? updatedAccountByName.get(accNameFromNotes) : updatedAccounts[0]?.id;
        
        if (!accountId) continue;

        await addHolding({
          ticker: h.ticker,
          name: h.name || h.ticker,
          type: h.type || 'stock',
          quantity: h.quantity,
          accountId,
          bucket: h.bucket || 'unassigned'
        });
        imported++;
      }
    }

    if (imported > 0) {
      toast.success(`Imported ${imported} holdings` + (result.newAccounts.length > 0 ? ` and created ${result.newAccounts.length} accounts` : ''));
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePDFImport = async (file: File) => {
    try {
      toast.info('Processing PDF...');
      
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      const response = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64 })
      });
      
      if (!response.ok) {
        throw new Error('Failed to parse PDF');
      }
      
      const data = await response.json();
      const pdfHoldings = data.holdings as Array<{ticker: string, name: string, shares: number, price: number, value: number, bucket: string}>;
      
      if (pdfHoldings.length === 0) {
        toast.error('No holdings found in PDF');
        return;
      }
      
      // Create a default account if none exist
      if (accounts.length === 0) {
        addAccount({ name: 'Imported Portfolio', type: 'taxable' });
      }
      
      const defaultAccountId = useStore.getState().accounts[0]?.id;
      if (!defaultAccountId) {
        toast.error('No account available');
        return;
      }
      
      let imported = 0;
      for (const h of pdfHoldings) {
        if (h.ticker && h.shares > 0) {
          await addHolding({
            ticker: h.ticker,
            name: h.name || h.ticker,
            type: inferTypeFromTicker(h.ticker),
            quantity: h.shares,
            accountId: defaultAccountId,
            bucket: h.bucket as any || 'unassigned',
            currentPrice: h.price,
            isManualPrice: true
          });
          imported++;
        }
      }
      
      if (imported > 0) {
        toast.success(`Imported ${imported} holdings from PDF`);
      }
    } catch (error) {
      console.error('PDF import error:', error);
      toast.error('Failed to import PDF');
    }
  };

  const inferTypeFromTicker = (ticker: string): 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'cash' | 'other' => {
    const t = ticker.toUpperCase();
    if (['SPAXX', 'FDRXX', 'VMFXX', 'SWVXX', 'FGTXX', 'MFIS', 'MFRS', 'CASH'].some(c => t.includes(c))) return 'cash';
    if (t.endsWith('X') && t.length === 5) return 'mutual_fund';
    if (['BND', 'TIP', 'IUSB', 'IGIB', 'VGIT', 'USHY', 'AGG', 'TLT'].some(b => t.includes(b))) return 'bond';
    if (['BTC', 'ETH', 'IBIT', 'GBTC'].some(c => t.includes(c))) return 'other';
    return 'etf';
  };

  const handlePriceChange = (id: string, newPrice: number) => {
    updateHolding(id, { currentPrice: newPrice, isManualPrice: true });
    toast.success('Price updated');
  };

  const handleQuantityChange = (id: string, newQty: number) => {
    updateHolding(id, { quantity: newQty });
    toast.success('Quantity updated');
  };

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || 'Unknown Account';

  const bucketColors: Record<BucketType, string> = {
    cash: 'bg-chart-3/20 text-chart-3 border-chart-3/30',
    income: 'bg-chart-2/20 text-chart-2-foreground border-chart-2/30',
    growth: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
    unassigned: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl font-serif">Portfolio Holdings</CardTitle>
        <div className="flex gap-2 flex-wrap justify-end">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExport}
                className="gap-2"
                disabled={holdings.length === 0}
            >
                <Download size={14} />
                <span className="hidden sm:inline">Export</span>
            </Button>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={handleImportClick}
                className="gap-2"
            >
                <Upload size={14} />
                <span className="hidden sm:inline">Import</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-2"
            >
                <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
                <span className="hidden sm:inline">{isRefreshing ? "Updating..." : "Update Prices"}</span>
            </Button>
            <AddAccountDialog variant="outline" />
            <AddHoldingDialog />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs md:text-sm">Ticker</TableHead>
                <TableHead className="hidden sm:table-cell text-xs md:text-sm">Name</TableHead>
                <TableHead className="hidden lg:table-cell text-xs md:text-sm">Account</TableHead>
                <TableHead className="text-right hidden md:table-cell text-xs md:text-sm">Qty</TableHead>
                <TableHead className="text-right hidden sm:table-cell text-xs md:text-sm">Price</TableHead>
                <TableHead className="text-right text-xs md:text-sm">Value</TableHead>
                <TableHead className="text-xs md:text-sm">Bucket</TableHead>
                <TableHead className="text-right text-xs md:text-sm w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        {accounts.length === 0 
                          ? "Start by adding an account above, then add your holdings."
                          : "No holdings added yet. Add your first position to get started."}
                    </TableCell>
                </TableRow>
              ) : (
                holdings.map((holding) => (
                <TableRow key={holding.id}>
                  <TableCell className="font-mono font-medium text-xs md:text-sm py-2 md:py-4">{holding.ticker}</TableCell>
                  <TableCell className="max-w-[200px] truncate hidden sm:table-cell text-xs md:text-sm py-2 md:py-4" title={holding.name}>
                    {holding.name}
                    {holding.isManualPrice && (
                      <span className="ml-1 text-[10px] text-muted-foreground">(m)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs hidden lg:table-cell py-2 md:py-4">
                    {getAccountName(holding.accountId)}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell py-2 md:py-4">
                    <EditableCell
                      value={holding.quantity}
                      onSave={(val) => handleQuantityChange(holding.id, val)}
                      type="number"
                    />
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell py-2 md:py-4">
                    <EditableCell
                      value={holding.currentPrice}
                      onSave={(val) => handlePriceChange(holding.id, val)}
                      type="currency"
                      prefix="$"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-xs md:text-sm py-2 md:py-4">
                    ${(holding.quantity * holding.currentPrice / 1000).toFixed(1)}k
                  </TableCell>
                  <TableCell className="py-2 md:py-4">
                    <select 
                        className={cn(
                            "text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full border bg-transparent cursor-pointer outline-none focus:ring-2 focus:ring-ring",
                            bucketColors[holding.bucket]
                        )}
                        value={holding.bucket}
                        onChange={(e) => setBucket(holding.id, e.target.value as BucketType)}
                    >
                        <option value="cash">Cash</option>
                        <option value="income">Income</option>
                        <option value="growth">Growth</option>
                        <option value="unassigned">—</option>
                    </select>
                  </TableCell>
                  <TableCell className="text-right py-2 md:py-4">
                    <Button variant="ghost" size="icon" onClick={() => removeHolding(holding.id)} className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 size={12} />
                    </Button>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Tip: Click on any Price or Quantity to edit it directly. Changes are saved automatically.
        </p>
      </CardContent>
    </Card>
  );
}
