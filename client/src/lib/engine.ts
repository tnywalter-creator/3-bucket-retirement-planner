import { UserProfile, BucketConfig, Holding, BucketType, TaxConfig, Account, AccountType } from './types';
import { calculateRMD, isRMDAge } from './rmd';

export interface YearProjection {
  year: number;
  age: number;
  spendingNeed: number;
  income: number;
  withdrawalNeeded: number;
  taxOnWithdrawal: number;
  grossWithdrawal: number;
  
  startBalanceCash: number;
  startBalanceBridge: number;
  startBalanceGrowth: number;
  
  endBalanceCash: number;
  endBalanceBridge: number;
  endBalanceGrowth: number;
  
  totalPortfolio: number;
  withdrawalSource: string;
  withdrawalPhase: string;
  action: string;
  
  ssIncome: number;
  spouseSsIncome: number;
  otherIncome: number;
  spouseWorkIncome: number;

  // Round 3 additions
  rmdRequired: number;        // The minimum the IRS forces this year
  rmdSatisfied: boolean;      // Whether the actual withdrawal met or exceeded RMD
}

/** Optional per-year return overrides (used by Monte Carlo to inject stochastic draws). */
export interface ReturnOverrides {
  cash?: number[];
  bridge?: number[];
  growth?: number[];
}

/** Run options bundle so we can grow without breaking the call signature. */
export interface RunOptions {
  accounts?: Account[];
  returnOverrides?: ReturnOverrides;
}

const DEFAULT_TAX: TaxConfig = { federalRate: 22, stateRate: 5, capitalGainsRate: 15 };

/**
 * Build a per-bucket map of dollars by account type, used for weighted tax rate.
 * If no accounts are supplied, every dollar is treated as ordinary (legacy behavior).
 */
function buildBucketAccountMix(
  holdings: Holding[],
  accounts: Account[] | undefined,
): Record<BucketType, Record<AccountType, number>> {
  const empty = (): Record<AccountType, number> =>
    ({ taxable: 0, traditional_ira: 0, roth_ira: 0, '401k': 0, hsa: 0, other: 0 });
  const mix: Record<BucketType, Record<AccountType, number>> = {
    cash: empty(), bridge: empty(), growth: empty(), unassigned: empty(),
  };
  if (!accounts || accounts.length === 0) {
    // No account info: lump everything into 'other' so the legacy bucket-only tax fallback runs.
    for (const h of holdings) {
      mix[h.bucket].other += h.quantity * h.currentPrice;
    }
    return mix;
  }
  const accountTypeById = new Map(accounts.map(a => [a.id, a.type]));
  for (const h of holdings) {
    const type = (accountTypeById.get(h.accountId) ?? 'other') as AccountType;
    mix[h.bucket][type] += h.quantity * h.currentPrice;
  }
  return mix;
}

/**
 * Effective withdrawal tax rate, weighted by the account types holding dollars in this bucket.
 *  - Roth IRA:        0% (qualified distributions)
 *  - HSA:             0% (assumed qualified medical use; conservative for retirees on Medicare)
 *  - Traditional IRA / 401k:  ordinary income (fed + state)
 *  - Taxable brokerage:        cap gains (treated like the bridge legacy logic)
 *  - "other" / unknown:        legacy fallback to phase-based rate
 */
function getWeightedTaxRate(
  tax: TaxConfig,
  phase: 'cash' | 'bridge' | 'growth',
  bucketMix: Record<AccountType, number>,
): number {
  if (phase === 'cash') return 0; // HYSA / cash equivalents
  const total = Object.values(bucketMix).reduce((s, v) => s + v, 0);
  if (total <= 0) return getLegacyEffectiveRate(tax, phase);

  const ordinary = tax.federalRate + tax.stateRate;
  const capGains = tax.capitalGainsRate + tax.stateRate;
  const fallback = getLegacyEffectiveRate(tax, phase);

  let weightedRate = 0;
  weightedRate += (bucketMix.roth_ira / total) * 0;
  weightedRate += (bucketMix.hsa / total) * 0;
  weightedRate += (bucketMix.traditional_ira / total) * ordinary;
  weightedRate += (bucketMix['401k'] / total) * ordinary;
  weightedRate += (bucketMix.taxable / total) * capGains;
  weightedRate += (bucketMix.other / total) * fallback;
  return weightedRate;
}

function getLegacyEffectiveRate(tax: TaxConfig, phase: 'cash' | 'bridge' | 'growth'): number {
  if (phase === 'cash') return 0;
  if (phase === 'bridge') return tax.capitalGainsRate + tax.stateRate;
  return tax.federalRate + tax.stateRate;
}

/**
 * Backwards-compatible shape: existing callers pass (profile, config, holdings).
 * New callers can pass an options bag with accounts (for account-aware tax) and
 * returnOverrides (for Monte Carlo).
 */
export function runProjection(
  profile: UserProfile,
  bucketConfig: BucketConfig,
  currentHoldings: Holding[],
  options?: RunOptions,
): YearProjection[] {
  const currentYear = new Date().getFullYear();
  const projections: YearProjection[] = [];
  const tax = profile.taxConfig || DEFAULT_TAX;
  const accounts = options?.accounts;
  const overrides = options?.returnOverrides;

  let cashBal = currentHoldings.filter(h => h.bucket === 'cash').reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
  let bridgeBal = currentHoldings.filter(h => h.bucket === 'bridge').reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
  let growthBal = currentHoldings.filter(h => h.bucket === 'growth').reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);

  // Snapshot of starting account-type mix per bucket. We assume the mix stays
  // proportional as the bucket grows/shrinks (a simplification, but better than
  // ignoring account types entirely).
  const initialMix = buildBucketAccountMix(currentHoldings, accounts);

  // Track traditional balance separately for RMD calculations.
  // We approximate it as (initial traditional share of total) * current total.
  const totalInitial = cashBal + bridgeBal + growthBal;
  const traditionalShare = totalInitial > 0
    ? (initialMix.cash.traditional_ira + initialMix.cash['401k']
     + initialMix.bridge.traditional_ira + initialMix.bridge['401k']
     + initialMix.growth.traditional_ira + initialMix.growth['401k']) / totalInitial
    : 0;

  let age = profile.currentAge;
  const retirementAge = profile.retirementAge ?? profile.currentAge;
  const endAge = profile.lifeExpectancy;
  const yearsToProject = endAge - age;

  // retirementYear tracks how many years into retirement we are (0 = first retirement year)
  let retirementYear = -1;

  for (let i = 0; i <= yearsToProject; i++) {
    const year = currentYear + i;
    const isRetired = age >= retirementAge;
    if (isRetired) retirementYear++;

    const inflationMultiplier = Math.pow(1 + (profile.inflationRate / 100), i);
    const yearlySpending = profile.monthlySpending * 12 * inflationMultiplier;

    // Returns: prefer Monte Carlo overrides, else config defaults.
    const cashReturn = overrides?.cash?.[i] ?? bucketConfig.cashReturn / 100;
    const bridgeReturn = overrides?.bridge?.[i] ?? bucketConfig.bridgeReturn / 100;
    const growthReturn = overrides?.growth?.[i] ?? bucketConfig.growthReturn / 100;

    let ssIncome = 0;
    let spouseSsIncome = 0;
    let spouseWorkIncome = 0;
    // Other income inflates over time (was a constant before — fixed in round 3).
    let otherInc = profile.otherIncome * 12 * inflationMultiplier;

    // Spouse work income: assume it stops at the retirement age (treat the retirement
    // age in the profile as a household event). Inflate while still working.
    if (profile.spouseIncome && !isRetired) {
      spouseWorkIncome = profile.spouseIncome * 12 * inflationMultiplier;
    }

    if (age >= profile.socialSecurityAge) {
      ssIncome = profile.socialSecurityAmount * 12 * inflationMultiplier;
    }

    if (profile.spouseAge && profile.spouseSocialSecurityAge && profile.spouseSocialSecurityAmount) {
      const spouseCurrentAge = (age - profile.currentAge) + profile.spouseAge;
      if (spouseCurrentAge >= profile.spouseSocialSecurityAge) {
        spouseSsIncome = profile.spouseSocialSecurityAmount * 12 * inflationMultiplier;
      }
    }

    const yearlyIncome = ssIncome + spouseSsIncome + spouseWorkIncome + otherInc;

    const startCash = cashBal;
    const startBridge = bridgeBal;
    const startGrowth = growthBal;
    const startTotal = startCash + startBridge + startGrowth;

    let withdrawalSource = '';
    let withdrawalPhase = '';
    let action = '';
    let withdrawalNeeded = 0;
    let taxOnWithdrawal = 0;
    let grossWithdrawal = 0;
    let rmdRequired = 0;
    let rmdSatisfied = true;

    if (!isRetired) {
      withdrawalPhase = 'Pre-Retirement';
      withdrawalSource = 'Working';
      withdrawalNeeded = 0;
      grossWithdrawal = 0;

      cashBal = Math.max(0, cashBal) * (1 + cashReturn);
      bridgeBal = Math.max(0, bridgeBal) * (1 + bridgeReturn);
      growthBal = Math.max(0, growthBal) * (1 + growthReturn);
    } else {
      withdrawalNeeded = Math.max(0, yearlySpending - yearlyIncome);

      const phase = retirementYear < bucketConfig.cashTargetYears ? 'cash'
        : retirementYear < bucketConfig.cashTargetYears + bucketConfig.bridgeTargetYears ? 'bridge'
        : 'growth';

      // Account-type weighted tax rate — accounts param required, otherwise falls back to legacy phase-based rate.
      const bucketMix = phase === 'cash' ? initialMix.cash : phase === 'bridge' ? initialMix.bridge : initialMix.growth;
      const effectiveTaxRate = getWeightedTaxRate(tax, phase, bucketMix);
      const clampedRate = Math.max(0, Math.min(0.95, effectiveTaxRate / 100));
      grossWithdrawal = withdrawalNeeded / (1 - clampedRate);
      taxOnWithdrawal = grossWithdrawal - withdrawalNeeded;

      // RMD enforcement — at age 73+, force at least the IRS minimum out of traditional balances.
      // Approximate traditional balance = traditionalShare * current total.
      if (isRMDAge(age)) {
        const approxTradBalance = traditionalShare * startTotal;
        rmdRequired = calculateRMD(approxTradBalance, age);
        if (rmdRequired > grossWithdrawal) {
          // Force the RMD as the gross. Tax is applied at ordinary income on the additional draw.
          const extra = rmdRequired - grossWithdrawal;
          const ordinary = (tax.federalRate + tax.stateRate) / 100;
          taxOnWithdrawal += extra * ordinary;
          grossWithdrawal = rmdRequired;
          // The "needed" portion stays the same; the extra goes back into spending margin (not modeled as reinvestment yet).
          rmdSatisfied = true;
          action = action ? action + ' + RMD' : 'RMD enforced';
        }
      }

      let remaining = grossWithdrawal;

      if (retirementYear < bucketConfig.cashTargetYears) {
        withdrawalPhase = `Retirement Years 1-${bucketConfig.cashTargetYears}: Cash Reserve`;
        if (cashBal >= remaining) {
          cashBal -= remaining;
          remaining = 0;
          withdrawalSource = 'Bucket 1 (Cash)';
        } else {
          remaining -= cashBal;
          cashBal = 0;
          withdrawalSource = 'Cash (Depleted)';
          if (bridgeBal >= remaining) {
            bridgeBal -= remaining;
            remaining = 0;
            withdrawalSource += ' + Bridge';
          } else {
            remaining -= bridgeBal;
            bridgeBal = 0;
            growthBal -= remaining;
            withdrawalSource += ' + Bridge + Growth';
          }
        }
      } else if (retirementYear < bucketConfig.cashTargetYears + bucketConfig.bridgeTargetYears) {
        withdrawalPhase = `Retirement Years ${bucketConfig.cashTargetYears + 1}-${bucketConfig.cashTargetYears + bucketConfig.bridgeTargetYears}: Bridge`;
        if (bridgeBal >= remaining) {
          bridgeBal -= remaining;
          remaining = 0;
          withdrawalSource = 'Bucket 2 (Bridge)';
        } else {
          remaining -= bridgeBal;
          bridgeBal = 0;
          withdrawalSource = 'Bridge (Depleted)';
          if (growthBal >= remaining) {
            growthBal -= remaining;
            remaining = 0;
            withdrawalSource += ' + Growth';
          } else {
            growthBal -= remaining;
            withdrawalSource += ' + Growth (Depleted)';
          }
        }
      } else {
        withdrawalPhase = `Retirement Year ${bucketConfig.cashTargetYears + bucketConfig.bridgeTargetYears + 1}+: Growth`;
        if (growthBal >= remaining) {
          growthBal -= remaining;
          remaining = 0;
          withdrawalSource = 'Bucket 3 (Growth)';
        } else {
          growthBal -= remaining;
          withdrawalSource = 'Growth (Depleted!)';
        }
      }

      cashBal = Math.max(0, cashBal) * (1 + cashReturn);
      bridgeBal = Math.max(0, bridgeBal) * (1 + bridgeReturn);
      growthBal = Math.max(0, growthBal) * (1 + growthReturn);

      if (retirementYear >= bucketConfig.cashTargetYears && retirementYear < bucketConfig.cashTargetYears + bucketConfig.bridgeTargetYears) {
        const targetCash = yearlySpending;
        if (cashBal < targetCash && bridgeBal > targetCash * 2) {
          const refill = targetCash - cashBal;
          bridgeBal -= refill;
          cashBal += refill;
          action = action ? action + ' + Refill Cash' : 'Refill Cash from Bridge';
        }
      }
    }

    projections.push({
      year,
      age,
      spendingNeed: yearlySpending,
      income: yearlyIncome,
      withdrawalNeeded,
      taxOnWithdrawal,
      grossWithdrawal,
      startBalanceCash: startCash,
      startBalanceBridge: startBridge,
      startBalanceGrowth: startGrowth,
      endBalanceCash: Math.max(0, cashBal),
      endBalanceBridge: Math.max(0, bridgeBal),
      endBalanceGrowth: Math.max(0, growthBal),
      totalPortfolio: Math.max(0, cashBal) + Math.max(0, bridgeBal) + Math.max(0, growthBal),
      withdrawalSource,
      withdrawalPhase,
      action,
      ssIncome,
      spouseSsIncome,
      otherIncome: otherInc + spouseWorkIncome,
      spouseWorkIncome,
      rmdRequired,
      rmdSatisfied,
    });

    age++;
  }

  return projections;
}

export interface SSComparison {
  claimAge: number;
  monthlyBenefit: number;
  lifetimeTotal: number;
  portfolioAtEnd: number;
  depletionAge: number | null;
}

export function compareSSClaimingAges(
  profile: UserProfile,
  bucketConfig: BucketConfig,
  currentHoldings: Holding[]
): SSComparison[] {
  const ages = [62, 64, 67, 70];
  const baseAmount = profile.socialSecurityAmount;
  const baseBenefitAge = 67;

  return ages.map(claimAge => {
    let factor: number;
    if (claimAge < baseBenefitAge) {
      const monthsEarly = (baseBenefitAge - claimAge) * 12;
      factor = 1 - (monthsEarly <= 36 ? monthsEarly * 0.00556 : 36 * 0.00556 + (monthsEarly - 36) * 0.00417);
    } else if (claimAge > baseBenefitAge) {
      factor = 1 + (claimAge - baseBenefitAge) * 0.08;
    } else {
      factor = 1;
    }
    
    const monthlyBenefit = Math.round(baseAmount * factor);
    
    const modifiedProfile = { ...profile, socialSecurityAge: claimAge, socialSecurityAmount: monthlyBenefit };
    const projection = runProjection(modifiedProfile, bucketConfig, currentHoldings);
    
    const depletionYear = projection.find(d => d.totalPortfolio <= 0);
    const finalBalance = projection[projection.length - 1]?.totalPortfolio || 0;
    
    const yearsReceiving = Math.max(0, profile.lifeExpectancy - claimAge);
    const lifetimeTotal = monthlyBenefit * 12 * yearsReceiving;
    
    return {
      claimAge,
      monthlyBenefit,
      lifetimeTotal,
      portfolioAtEnd: finalBalance,
      depletionAge: depletionYear ? depletionYear.age : null,
    };
  });
}
