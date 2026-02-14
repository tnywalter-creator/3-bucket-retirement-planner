import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const holdingSchema = z.object({
  ticker: z.string().min(1, "Ticker is required"),
  quantity: z.string().transform(val => Number(val)).pipe(z.number().positive("Quantity must be positive")),
  bucket: z.enum(['cash', 'income', 'growth', 'unassigned']),
  accountId: z.string().min(1, "Account is required"),
  type: z.enum(['stock', 'etf', 'mutual_fund', 'bond', 'cash']),
});

export function AddHoldingDialog() {
  const [open, setOpen] = useState(false);
  const { addHolding, accounts } = useStore();

  const form = useForm<z.infer<typeof holdingSchema>>({
    resolver: zodResolver(holdingSchema),
    defaultValues: {
      ticker: '',
      quantity: 0,
      bucket: 'unassigned',
      accountId: accounts[0]?.id || '',
      type: 'stock',
    },
  });

  const onSubmit = async (values: z.infer<typeof holdingSchema>) => {
    try {
      await addHolding({
        ticker: values.ticker.toUpperCase(),
        quantity: values.quantity,
        bucket: values.bucket as any,
        accountId: values.accountId,
        type: values.type as any,
        name: '', // Will be fetched
        notes: '',
      });
      setOpen(false);
      form.reset();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add Holding</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Position</DialogTitle>
          <DialogDescription>
            Enter the details of your holding. We'll fetch the current price automatically.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="ticker"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Ticker Symbol</FormLabel>
                    <FormControl>
                        <Input placeholder="VTI" {...field} className="uppercase font-mono" />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="100" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="stock">Stock</SelectItem>
                      <SelectItem value="etf">ETF</SelectItem>
                      <SelectItem value="mutual_fund">Mutual Fund</SelectItem>
                      <SelectItem value="bond">Bond</SelectItem>
                      <SelectItem value="cash">Cash / Money Market</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bucket"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial Bucket Assignment</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bucket" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Bucket 1: Cash</SelectItem>
                      <SelectItem value="income">Bucket 2: Income</SelectItem>
                      <SelectItem value="growth">Bucket 3: Growth</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                            {account.name} ({account.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">Add Position</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
