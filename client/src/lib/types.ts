
export type AssetType = 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'cash' | 'other';
export type AccountType = 'taxable' | 'traditional_ira' | 'roth_ira' | '401k' | 'other';
export type BucketType = 'cash' | 'income' | 'growth' | 'unassigned';

export interface Holding {
  id: string;
  ticker: string;
  name: string;
  type: AssetType;
  quantity: number;
  costBasisPerShare?: number;
  currentPrice: number;
  lastUpdated: string; // ISO date
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

export interface UserProfile {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  monthlySpending: number;
  inflationRate: number; // percentage
  socialSecurityAge: number;
  socialSecurityAmount: number; // monthly
  spouseAge?: number;
  spouseSocialSecurityAge?: number;
  spouseSocialSecurityAmount?: number; // monthly
  otherIncome: number; // monthly
}

export interface BucketConfig {
  cashReturn: number; // %
  incomeReturn: number; // %
  growthReturn: number; // %
  cashTargetYears: number; // e.g., 2 years
  incomeTargetYears: number; // e.g., 5 years
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
