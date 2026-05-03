
export type AssetType = 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'cash' | 'other';
export type AccountType = 'taxable' | 'traditional_ira' | 'roth_ira' | '401k' | 'hsa' | 'other';
export type BucketType = 'cash' | 'bridge' | 'growth' | 'unassigned';

export interface Holding {
  id: string;
  ticker: string;
  name: string;
  type: AssetType;
  quantity: number;
  costBasisPerShare?: number;
  currentPrice: number;
  lastUpdated: string;
  accountId: string;
  bucket: BucketType;
  notes?: string;
  isManualPrice?: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
}

export interface TaxConfig {
  federalRate: number;
  stateRate: number;
  capitalGainsRate: number;
}

export interface UserProfile {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  monthlySpending: number;
  inflationRate: number;
  socialSecurityAge: number;
  socialSecurityAmount: number;
  spouseAge?: number;
  spouseName?: string;
  spouseSocialSecurityAge?: number;
  spouseSocialSecurityAmount?: number;
  spouseIncome?: number;
  otherIncome: number;
  taxConfig?: TaxConfig;
}

export interface BucketConfig {
  cashReturn: number;
  bridgeReturn: number;
  growthReturn: number;
  cashTargetYears: number;
  bridgeTargetYears: number;
  cashTarget: number;
  bridgeTarget: number;
  growthTarget: number;
  withdrawalRate: number;
}

export interface Scenario {
  id: string;
  name: string;
  profile: UserProfile;
  bucketConfig: BucketConfig;
}

export interface MarketData {
  ticker: string;
  price: number;
  changePercent: number;
  name: string;
}

export interface FundingSource {
  id: string;
  name: string;
  grossAmount: number;
  taxRate: number;
  netAmount: number;
  targetBucket: BucketType;
  timeline: string;
  status: 'completed' | 'pending' | 'future';
}

export interface ActionItem {
  id: string;
  action: string;
  amount: number;
  destination: string;
  timeline: string;
  phase: 'now' | 'april-2026' | 'july-2026' | '2027';
  completed: boolean;
}

export interface RebalanceAction {
  ticker: string;
  bucket: BucketType;
  currentValue: number;
  targetValue: number;
  difference: number;
  action: 'buy' | 'sell' | 'hold';
}
