import { Holding, BucketConfig, BucketType, RebalanceAction } from './types';

export function calculateRebalancing(
  holdings: Holding[],
  bucketConfig: BucketConfig
): { bucketSummary: BucketRebalance[]; totalValue: number; totalTarget: number } {
  const bucketValues: Record<BucketType, number> = {
    cash: 0,
    bridge: 0,
    growth: 0,
    unassigned: 0,
  };

  holdings.forEach(h => {
    const val = h.quantity * h.currentPrice;
    bucketValues[h.bucket] += val;
  });

  const totalValue = bucketValues.cash + bucketValues.bridge + bucketValues.growth + bucketValues.unassigned;
  const totalTarget = bucketConfig.cashTarget + bucketConfig.bridgeTarget + bucketConfig.growthTarget;

  const buckets: { key: BucketType; label: string; target: number; color: string }[] = [
    { key: 'cash', label: 'Cash Reserve', target: bucketConfig.cashTarget, color: 'chart-3' },
    { key: 'bridge', label: 'Bridge', target: bucketConfig.bridgeTarget, color: 'chart-2' },
    { key: 'growth', label: 'Growth', target: bucketConfig.growthTarget, color: 'chart-1' },
  ];

  const bucketSummary: BucketRebalance[] = buckets.map(b => {
    const current = bucketValues[b.key];
    const target = b.target;
    const diff = current - target;
    const pctOfTarget = target > 0 ? (current / target) * 100 : 0;

    let action: 'add' | 'reduce' | 'on-target';
    if (Math.abs(diff) < target * 0.02) {
      action = 'on-target';
    } else if (diff < 0) {
      action = 'add';
    } else {
      action = 'reduce';
    }

    return {
      bucket: b.key,
      label: b.label,
      color: b.color,
      currentValue: current,
      targetValue: target,
      difference: diff,
      percentOfTarget: pctOfTarget,
      action,
    };
  });

  return { bucketSummary, totalValue, totalTarget };
}

export interface BucketRebalance {
  bucket: BucketType;
  label: string;
  color: string;
  currentValue: number;
  targetValue: number;
  difference: number;
  percentOfTarget: number;
  action: 'add' | 'reduce' | 'on-target';
}
