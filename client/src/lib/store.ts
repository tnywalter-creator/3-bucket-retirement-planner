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
  
  addAccount: (account: Omit<Account, 'id'>) => void;
  removeAccount: (id: string) => void;
  addHolding: (holding: Omit<Holding, 'id' | 'currentPrice' | 'lastUpdated'> & { currentPrice?: number; isManualPrice?: boolean }) => Promise<void>;
  updateHolding: (id: string, updates: Partial<Holding>) => void;
  removeHolding: (id: string) => void;
  setBucket: (holdingId: string, bucket: BucketType) => void;
  refreshPrices: () => Promise<void>;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  updateBucketConfig: (config: Partial<BucketConfig>) => void;
  addScenario: (name: string) => string;
  removeScenario: (id: string) => void;
  duplicateScenario: (id: string, newName: string) => string;
  renameScenario: (id: string, name: string) => void;
  setActiveScenario: (id: string) => void;
  resetToDefaults: () => void;
}

const DEFAULT_PROFILE: UserProfile = {
  currentAge: 56,
  retirementAge: 56,
  lifeExpectancy: 90,
  monthlySpending: 8000,
  inflationRate: 3.0,
  socialSecurityAge: 67,
  socialSecurityAmount: 2500,
  spouseAge: 54,
  spouseName: 'Angela',
  spouseSocialSecurityAge: 67,
  spouseSocialSecurityAmount: 1800,
  spouseIncome: 3333,
  otherIncome: 0,
  taxConfig: { federalRate: 22, stateRate: 5, capitalGainsRate: 15 },
};

const DEFAULT_BUCKET_CONFIG: BucketConfig = {
  cashReturn: 4.0,
  bridgeReturn: 6.0,
  growthReturn: 7.0,
  cashTargetYears: 3,
  bridgeTargetYears: 7,
  cashTarget: 288000,
  bridgeTarget: 672000,
  growthTarget: 1384000,
  withdrawalRate: 4.25,
};

const DEFAULT_SCENARIO: Scenario = {
  id: 'default',
  name: 'Base Plan',
  profile: DEFAULT_PROFILE,
  bucketConfig: DEFAULT_BUCKET_CONFIG,
};

// Old aggressive defaults — if a scenario still has these exact values, bump them down.
const OLD_RETURNS = { cashReturn: 4.5, bridgeReturn: 6.5, growthReturn: 8.5 };

function migrateState(persistedState: any): any {
  if (!persistedState) return persistedState;
  
  if (persistedState.holdings) {
    persistedState.holdings = persistedState.holdings.map((h: any) => {
      if (h.bucket === 'income') {
        return { ...h, bucket: 'bridge' };
      }
      return h;
    });
  }
  
  if (persistedState.scenarios) {
    persistedState.scenarios = persistedState.scenarios.map((s: any) => {
      const bc = s.bucketConfig;
      if (bc && ('incomeReturn' in bc || !('bridgeReturn' in bc))) {
        return {
          ...s,
          bucketConfig: {
            cashReturn: bc.cashReturn ?? DEFAULT_BUCKET_CONFIG.cashReturn,
            bridgeReturn: bc.bridgeReturn ?? bc.incomeReturn ?? DEFAULT_BUCKET_CONFIG.bridgeReturn,
            growthReturn: bc.growthReturn ?? DEFAULT_BUCKET_CONFIG.growthReturn,
            cashTargetYears: bc.cashTargetYears ?? DEFAULT_BUCKET_CONFIG.cashTargetYears,
            bridgeTargetYears: bc.bridgeTargetYears ?? bc.incomeTargetYears ?? DEFAULT_BUCKET_CONFIG.bridgeTargetYears,
            cashTarget: bc.cashTarget ?? DEFAULT_BUCKET_CONFIG.cashTarget,
            bridgeTarget: bc.bridgeTarget ?? DEFAULT_BUCKET_CONFIG.bridgeTarget,
            growthTarget: bc.growthTarget ?? DEFAULT_BUCKET_CONFIG.growthTarget,
            withdrawalRate: bc.withdrawalRate ?? DEFAULT_BUCKET_CONFIG.withdrawalRate,
          }
        };
      }
      if (bc && !('cashTarget' in bc)) {
        return {
          ...s,
          bucketConfig: {
            ...bc,
            cashTarget: DEFAULT_BUCKET_CONFIG.cashTarget,
            bridgeTarget: DEFAULT_BUCKET_CONFIG.bridgeTarget,
            growthTarget: DEFAULT_BUCKET_CONFIG.growthTarget,
            withdrawalRate: DEFAULT_BUCKET_CONFIG.withdrawalRate,
          }
        };
      }
      if (s.profile && !s.profile.taxConfig) {
        return {
          ...s,
          profile: { ...s.profile, taxConfig: DEFAULT_PROFILE.taxConfig }
        };
      }
      // v2→v3: if return rates are still at the old aggressive defaults, update them.
      if (bc &&
          bc.cashReturn === OLD_RETURNS.cashReturn &&
          bc.bridgeReturn === OLD_RETURNS.bridgeReturn &&
          bc.growthReturn === OLD_RETURNS.growthReturn) {
        return {
          ...s,
          bucketConfig: {
            ...bc,
            cashReturn: DEFAULT_BUCKET_CONFIG.cashReturn,
            bridgeReturn: DEFAULT_BUCKET_CONFIG.bridgeReturn,
            growthReturn: DEFAULT_BUCKET_CONFIG.growthReturn,
          }
        };
      }
      return s;
    });
  }
  
  return persistedState;
}

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
        const skipTickers = ['INVESC', 'BNYMEL', 'PIMCOV', 'MFIS', 'MFRS', 'FGTXX', 'DEPOSIT', 'CASH'];
        const updates = await Promise.all(holdings.map(async (h) => {
          if (h.type === 'cash' || skipTickers.includes(h.ticker.toUpperCase()) || h.ticker.includes('.')) return h;
          try {
            const response = await fetch(`/api/quote/${h.ticker}`);
            if (!response.ok) return h;
            const data = await response.json();
            if (!data.price || data.error) return h;
            return { ...h, currentPrice: data.price, isManualPrice: false, lastUpdated: new Date().toISOString() };
          } catch (e) {
            return h;
          }
        }));
        set({ holdings: updates });
      },

      updateUserProfile: (profile) => set((state) => ({
        scenarios: state.scenarios.map(s => {
          if (s.id !== state.activeScenarioId) return s;
          const newProfile = { ...s.profile, ...profile };
          // When monthly spending changes, recalculate all bucket targets
          if ('monthlySpending' in profile) {
            const bc = s.bucketConfig;
            const spending = newProfile.monthlySpending;
            const cashTarget = spending * 12 * bc.cashTargetYears;
            const bridgeTarget = spending * 12 * bc.bridgeTargetYears;
            const totalNeeded = (spending * 12) / (bc.withdrawalRate / 100);
            const growthTarget = Math.max(0, totalNeeded - cashTarget - bridgeTarget);
            return { ...s, profile: newProfile, bucketConfig: { ...bc, cashTarget, bridgeTarget, growthTarget } };
          }
          return { ...s, profile: newProfile };
        })
      })),

      updateBucketConfig: (config) => set((state) => ({
        scenarios: state.scenarios.map(s => {
          if (s.id !== state.activeScenarioId) return s;
          const newBc = { ...s.bucketConfig, ...config };
          // Recalculate targets whenever years or withdrawal rate changes
          const spending = s.profile.monthlySpending;
          const cashTarget = 'cashTarget' in config ? newBc.cashTarget
            : spending * 12 * newBc.cashTargetYears;
          const bridgeTarget = 'bridgeTarget' in config ? newBc.bridgeTarget
            : spending * 12 * newBc.bridgeTargetYears;
          // growthTarget = remainder of total portfolio needed
          const totalNeeded = (spending * 12) / (newBc.withdrawalRate / 100);
          const growthTarget = 'growthTarget' in config ? newBc.growthTarget
            : Math.max(0, totalNeeded - cashTarget - bridgeTarget);
          return { ...s, bucketConfig: { ...newBc, cashTarget, bridgeTarget, growthTarget } };
        })
      })),

      addScenario: (name) => {
        const id = uuidv4();
        set((state) => ({
          scenarios: [...state.scenarios, {
            id,
            name,
            profile: { ...DEFAULT_PROFILE },
            bucketConfig: { ...DEFAULT_BUCKET_CONFIG },
          }],
          activeScenarioId: id,
        }));
        return id;
      },

      duplicateScenario: (sourceId, newName) => {
        const { scenarios } = get();
        const source = scenarios.find(s => s.id === sourceId);
        if (!source) return sourceId;
        const id = uuidv4();
        set((state) => ({
          scenarios: [...state.scenarios, {
            id,
            name: newName,
            profile: { ...source.profile },
            bucketConfig: { ...source.bucketConfig },
          }],
          activeScenarioId: id,
        }));
        return id;
      },

      removeScenario: (id) => set((state) => {
        if (state.scenarios.length <= 1) return state;
        const filtered = state.scenarios.filter(s => s.id !== id);
        return {
          scenarios: filtered,
          activeScenarioId: state.activeScenarioId === id ? filtered[0].id : state.activeScenarioId,
        };
      }),

      renameScenario: (id, name) => set((state) => ({
        scenarios: state.scenarios.map(s => s.id === id ? { ...s, name } : s)
      })),

      setActiveScenario: (id) => set({ activeScenarioId: id }),

      resetToDefaults: () => {
        localStorage.removeItem('retirement-planner-storage');
        window.location.reload();
      },
    }),
    {
      name: 'retirement-planner-storage',
      version: 2,
      migrate: (persistedState, version) => {
        if (version < 2) {
          return migrateState(persistedState);
        }
        return persistedState as AppState;
      },
    }
  )
);
