import { UserProfile, BucketConfig, Holding, BucketType } from './types';

export interface YearProjection {
  year: number;
  age: number;
  spendingNeed: number;
  income: number;
  withdrawalNeeded: number;
  
  startBalanceCash: number;
  startBalanceIncome: number;
  startBalanceGrowth: number;
  
  endBalanceCash: number;
  endBalanceIncome: number;
  endBalanceGrowth: number;
  
  totalPortfolio: number;
  withdrawalSource: string; // 'Cash', 'Income', 'Growth' or combo
  action: string; // 'Rebalance', 'Spend Cash', etc.
}

export function runProjection(
  profile: UserProfile, 
  bucketConfig: BucketConfig, 
  currentHoldings: Holding[]
): YearProjection[] {
  const currentYear = new Date().getFullYear();
  const projections: YearProjection[] = [];
  
  // 1. Calculate Starting Balances per Bucket
  let cashBal = currentHoldings.filter(h => h.bucket === 'cash').reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
  let incomeBal = currentHoldings.filter(h => h.bucket === 'income').reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
  let growthBal = currentHoldings.filter(h => h.bucket === 'growth').reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);

  let age = profile.currentAge;
  const endAge = profile.lifeExpectancy;
  const yearsToProject = endAge - age;

  for (let i = 0; i <= yearsToProject; i++) {
    const year = currentYear + i;
    
    // Inflation Adjustment
    const inflationMultiplier = Math.pow(1 + (profile.inflationRate / 100), i);
    const yearlySpending = profile.monthlySpending * 12 * inflationMultiplier;
    
    // Income Calculation
    let yearlyIncome = profile.otherIncome * 12; // Assume other income flat or add inflation logic
    
    // Primary Earner SS
    if (age >= profile.socialSecurityAge) {
      yearlyIncome += (profile.socialSecurityAmount * 12 * inflationMultiplier);
    }

    // Spouse SS (if applicable)
    if (profile.spouseAge && profile.spouseSocialSecurityAge && profile.spouseSocialSecurityAmount) {
        // Calculate spouse's age in this projection year
        // We know 'age' is primary's age. 
        // Spouse Age = (age - profile.currentAge) + profile.spouseAge
        const spouseCurrentAge = (age - profile.currentAge) + profile.spouseAge;
        
        if (spouseCurrentAge >= profile.spouseSocialSecurityAge) {
            yearlyIncome += (profile.spouseSocialSecurityAmount * 12 * inflationMultiplier);
        }
    }
    
    const withdrawalNeeded = Math.max(0, yearlySpending - yearlyIncome);
    
    const startCash = cashBal;
    const startIncome = incomeBal;
    const startGrowth = growthBal;

    let withdrawalSource = '';
    let action = '';

    // WITHDRAWAL LOGIC (Simplified 3-Bucket)
    // 1. Spend from Income (Yield) + Cash first? 
    // Standard Strategy: Spend Cash bucket down. Refill Cash from Income/Growth.
    
    let remainingWithdrawal = withdrawalNeeded;
    
    // Step 1: Withdraw from Cash
    if (cashBal >= remainingWithdrawal) {
      cashBal -= remainingWithdrawal;
      remainingWithdrawal = 0;
      withdrawalSource = 'Cash Bucket';
    } else {
      // Deplete Cash
      remainingWithdrawal -= cashBal;
      cashBal = 0;
      withdrawalSource = 'Cash (Depleted) -> Income';
      
      // Step 2: Withdraw from Income
      if (incomeBal >= remainingWithdrawal) {
        incomeBal -= remainingWithdrawal;
        remainingWithdrawal = 0;
      } else {
        // Deplete Income
        remainingWithdrawal -= incomeBal;
        incomeBal = 0;
        withdrawalSource = 'Cash -> Income -> Growth';
        
        // Step 3: Withdraw from Growth (Risk!)
        growthBal -= remainingWithdrawal;
      }
    }

    // GROWTH & REBALANCING LOGIC
    // Apply returns to remaining balances
    cashBal *= (1 + bucketConfig.cashReturn / 100);
    incomeBal *= (1 + bucketConfig.incomeReturn / 100);
    growthBal *= (1 + bucketConfig.growthReturn / 100);

    // Refill Logic (Simplified)
    // If Cash < Target (e.g. 2 years spending), refill from Growth if Growth is doing well, or Income
    const targetCash = yearlySpending * bucketConfig.cashTargetYears;
    
    if (cashBal < targetCash) {
        const refillNeeded = targetCash - cashBal;
        // Try refill from Income first? Or Growth?
        // Let's refill from Growth to keep Income stable for stability? 
        // Or "Sell High": Realistically we need market performance data to know if we should sell growth.
        // Simplified: Refill from Growth if it has plenty.
        
        if (growthBal > refillNeeded * 2) { // arbitrary safety check
            growthBal -= refillNeeded;
            cashBal += refillNeeded;
            action = 'Refill Cash from Growth';
        } else if (incomeBal > refillNeeded) {
            incomeBal -= refillNeeded;
            cashBal += refillNeeded;
            action = 'Refill Cash from Income';
        }
    }

    projections.push({
      year,
      age,
      spendingNeed: yearlySpending,
      income: yearlyIncome,
      withdrawalNeeded,
      startBalanceCash: startCash,
      startBalanceIncome: startIncome,
      startBalanceGrowth: startGrowth,
      endBalanceCash: cashBal,
      endBalanceIncome: incomeBal,
      endBalanceGrowth: growthBal,
      totalPortfolio: cashBal + incomeBal + growthBal,
      withdrawalSource,
      action
    });

    age++;
  }

  return projections;
}
