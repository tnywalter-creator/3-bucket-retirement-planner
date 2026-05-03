import { UserProfile, BucketConfig, Holding, BucketType, TaxConfig } from './types';

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
}

const DEFAULT_TAX: TaxConfig = { federalRate: 22, stateRate: 5, capitalGainsRate: 15 };

export function runProjection(
  profile: UserProfile, 
  bucketConfig: BucketConfig, 
  currentHoldings: Holding[]
): YearProjection[] {
  const currentYear = new Date().getFullYear();
  const projections: YearProjection[] = [];
  const tax = profile.taxConfig || DEFAULT_TAX;
  
  let cashBal = currentHoldings.filter(h => h.bucket === 'cash').reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
  let bridgeBal = currentHoldings.filter(h => h.bucket === 'bridge').reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
  let growthBal = currentHoldings.filter(h => h.bucket === 'growth').reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);

  let age = profile.currentAge;
  const retirementAge = profile.retirementAge ?? profile.currentAge;
  const endAge = profile.lifeExpectancy;
  const yearsToProject = endAge - age;

  // retirementYear tracks how many years into retirement we are (0 = first retirement year)
  // This drives the bucket phase sequence independent of current age
  let retirementYear = -1;

  for (let i = 0; i <= yearsToProject; i++) {
    const year = currentYear + i;
    const isRetired = age >= retirementAge;
    if (isRetired) retirementYear++;

    const inflationMultiplier = Math.pow(1 + (profile.inflationRate / 100), i);
    const yearlySpending = profile.monthlySpending * 12 * inflationMultiplier;
    
    let ssIncome = 0;
    let spouseSsIncome = 0;
    let spouseWorkIncome = 0;
    let otherInc = profile.otherIncome * 12;
    
    if (profile.spouseIncome) {
      spouseWorkIncome = profile.spouseIncome * 12;
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

    let withdrawalSource = '';
    let withdrawalPhase = '';
    let action = '';
    let withdrawalNeeded = 0;
    let taxOnWithdrawal = 0;
    let grossWithdrawal = 0;

    if (!isRetired) {
      // Pre-retirement: portfolio grows, no bucket withdrawals needed
      withdrawalPhase = 'Pre-Retirement';
      withdrawalSource = 'Working';
      withdrawalNeeded = 0;
      grossWithdrawal = 0;

      cashBal = Math.max(0, cashBal) * (1 + bucketConfig.cashReturn / 100);
      bridgeBal = Math.max(0, bridgeBal) * (1 + bucketConfig.bridgeReturn / 100);
      growthBal = Math.max(0, growthBal) * (1 + bucketConfig.growthReturn / 100);
    } else {
      // Retirement: draw from buckets based on years into retirement
      withdrawalNeeded = Math.max(0, yearlySpending - yearlyIncome);

      const phase = retirementYear < bucketConfig.cashTargetYears ? 'cash'
        : retirementYear < bucketConfig.cashTargetYears + bucketConfig.bridgeTargetYears ? 'bridge'
        : 'growth';

      const effectiveTaxRate = getEffectiveTaxRate(tax, phase);
      taxOnWithdrawal = withdrawalNeeded * (effectiveTaxRate / 100);
      grossWithdrawal = withdrawalNeeded + taxOnWithdrawal;

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

      cashBal = Math.max(0, cashBal) * (1 + bucketConfig.cashReturn / 100);
      bridgeBal = Math.max(0, bridgeBal) * (1 + bucketConfig.bridgeReturn / 100);
      growthBal = Math.max(0, growthBal) * (1 + bucketConfig.growthReturn / 100);

      if (retirementYear >= bucketConfig.cashTargetYears && retirementYear < bucketConfig.cashTargetYears + bucketConfig.bridgeTargetYears) {
        const targetCash = yearlySpending;
        if (cashBal < targetCash && bridgeBal > targetCash * 2) {
          const refill = targetCash - cashBal;
          bridgeBal -= refill;
          cashBal += refill;
          action = 'Refill Cash from Bridge';
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
    });

    age++;
  }

  return projections;
}

function getEffectiveTaxRate(tax: TaxConfig, phase: 'cash' | 'bridge' | 'growth'): number {
  if (phase === 'cash') return 0;
  if (phase === 'bridge') return tax.capitalGainsRate;
  return (tax.federalRate + tax.stateRate) / 2;
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
