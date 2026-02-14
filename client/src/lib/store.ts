import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Account, Holding, Scenario, UserProfile, BucketConfig, BucketType } from './types';
import { getMarketPrice } from './marketData';

interface AppState {
  accounts: Account[];
  holdings: Holding[];
  scenarios: Scenario[];
  activeScenarioId: string;
  
  // Actions
  addAccount: (account: Omit<Account, 'id'>) => void;
  removeAccount: (id: string) => void;
  addHolding: (holding: Omit<Holding, 'id' | 'currentPrice' | 'lastUpdated'> & { currentPrice?: number; isManualPrice?: boolean }) => Promise<void>;
  updateHolding: (id: string, updates: Partial<Holding>) => void;
  removeHolding: (id: string) => void;
  setBucket: (holdingId: string, bucket: BucketType) => void;
  refreshPrices: () => Promise<void>;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  updateBucketConfig: (config: Partial<BucketConfig>) => void;
  resetToDefaults: () => void;
}

const DEFAULT_PROFILE: UserProfile = {
  currentAge: 55,
  retirementAge: 65,
  lifeExpectancy: 90,
  monthlySpending: 6000,
  inflationRate: 3.0,
  socialSecurityAge: 67,
  socialSecurityAmount: 2500,
  spouseAge: 53,
  spouseSocialSecurityAge: 67,
  spouseSocialSecurityAmount: 1800,
  otherIncome: 0,
};

const DEFAULT_BUCKET_CONFIG: BucketConfig = {
  cashReturn: 4.0,
  incomeReturn: 5.0,
  growthReturn: 8.0,
  cashTargetYears: 2,
  incomeTargetYears: 5,
};

const DEFAULT_SCENARIO: Scenario = {
  id: 'default',
  name: 'Base Plan',
  profile: DEFAULT_PROFILE,
  bucketConfig: DEFAULT_BUCKET_CONFIG,
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      accounts: [],
      holdings: [],
      scenarios: [DEFAULT_SCENARIO],
      activeScenarioId: 'default',

      addAccount: (account) => set((state) => ({ 
        accounts: [...state.accounts, { ...account, id: uuidv4() }] 
      })),

      removeAccount: (id) => set((state) => ({ 
        accounts: state.accounts.filter(a => a.id !== id),
        holdings: state.holdings.filter(h => h.accountId !== id)
      })),

      addHolding: async (holding) => {
        // If price already provided (e.g. from PDF import), use it; otherwise fetch from market
        let price = holding.currentPrice;
        let isManual = holding.isManualPrice || false;
        let displayName = holding.name;
        
        if (price === undefined) {
          const marketData = await getMarketPrice(holding.ticker);
          price = marketData.price;
          displayName = displayName || marketData.name;
        }
        
        set((state) => ({
          holdings: [...state.holdings, {
            ...holding,
            id: uuidv4(),
            currentPrice: price,
            name: displayName || holding.ticker,
            lastUpdated: new Date().toISOString(),
            isManualPrice: isManual
          }]
        }));
      },

      updateHolding: (id, updates) => set((state) => ({
        holdings: state.holdings.map(h => h.id === id ? { ...h, ...updates } : h)
      })),

      removeHolding: (id) => set((state) => ({
        holdings: state.holdings.filter(h => h.id !== id)
      })),

      setBucket: (holdingId, bucket) => set((state) => ({
        holdings: state.holdings.map(h => h.id === holdingId ? { ...h, bucket } : h)
      })),

      refreshPrices: async () => {
        const { holdings } = get();
        // Simple parallel fetch
        const updates = await Promise.all(holdings.map(async (h) => {
          if (h.type === 'cash' || h.isManualPrice) return h;
          try {
            const data = await getMarketPrice(h.ticker);
            return { ...h, currentPrice: data.price, lastUpdated: new Date().toISOString() };
          } catch (e) {
            console.error(`Failed to update ${h.ticker}`, e);
            return h;
          }
        }));
        set({ holdings: updates });
      },

      updateUserProfile: (profile) => set((state) => ({
        scenarios: state.scenarios.map(s => 
          s.id === state.activeScenarioId 
            ? { ...s, profile: { ...s.profile, ...profile } }
            : s
        )
      })),

      updateBucketConfig: (config) => set((state) => ({
        scenarios: state.scenarios.map(s => 
          s.id === state.activeScenarioId 
            ? { ...s, bucketConfig: { ...s.bucketConfig, ...config } }
            : s
        )
      })),

      resetToDefaults: () => {
        // Clear localStorage and reload
        localStorage.removeItem('retirement-planner-storage');
        window.location.reload();
      },
    }),
    {
      name: 'retirement-planner-storage',
    }
  )
);
