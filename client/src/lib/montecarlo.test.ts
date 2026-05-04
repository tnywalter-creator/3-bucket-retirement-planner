/*
 * Monte Carlo + account-aware tax + RMD tests.
 * Run with: npx tsx client/src/lib/montecarlo.test.ts
 */

import assert from 'node:assert/strict';
import { runProjection } from './engine';
import { runMonteCarlo, DEFAULT_VOL } from './montecarlo';
import { calculateRMD, isRMDAge, RMD_START_AGE } from './rmd';
import type { UserProfile, BucketConfig, Holding, Account, AccountType } from './types';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}`);
    console.error('    ', err instanceof Error ? err.message : err);
  }
}

const baseProfile: UserProfile = {
  currentAge: 56,
  retirementAge: 56,
  lifeExpectancy: 90,
  monthlySpending: 8000,
  inflationRate: 3,
  socialSecurityAge: 67,
  socialSecurityAmount: 2500,
  spouseAge: 54,
  spouseName: 'Angela',
  spouseSocialSecurityAge: 67,
  spouseSocialSecurityAmount: 1800,
  spouseIncome: 0,
  otherIncome: 0,
  taxConfig: { federalRate: 22, stateRate: 5, capitalGainsRate: 15 },
};

const baseConfig: BucketConfig = {
  cashReturn: 4.5, bridgeReturn: 6.5, growthReturn: 8.5,
  cashTargetYears: 3, bridgeTargetYears: 7,
  cashTarget: 288_000, bridgeTarget: 672_000, growthTarget: 1_384_000,
  withdrawalRate: 4.25,
};

function makeHolding(bucket: 'cash' | 'bridge' | 'growth', dollars: number, accountId = 'acct-1'): Holding {
  return {
    id: `${bucket}-${dollars}-${accountId}`,
    ticker: bucket.toUpperCase(),
    name: bucket,
    type: 'etf',
    quantity: dollars,
    currentPrice: 1,
    lastUpdated: new Date().toISOString(),
    accountId,
    bucket,
  };
}

function makeAccount(id: string, type: AccountType): Account {
  return { id, name: `${type}-${id}`, type };
}

console.log('Round 3 tests (Monte Carlo + Account Tax + RMD)\n');

// ============================================================================
// RMD math
// ============================================================================
console.log('  -- RMD --');

test('RMD is 0 below age 73', () => {
  for (let age = 60; age < RMD_START_AGE; age++) {
    assert.equal(calculateRMD(1_000_000, age), 0, `age ${age} should have no RMD`);
  }
});

test('RMD at 73 uses divisor 26.5', () => {
  // Per IRS Uniform Lifetime Table.
  const expected = 1_000_000 / 26.5;
  const actual = calculateRMD(1_000_000, 73);
  assert.ok(Math.abs(actual - expected) < 0.01, `expected ~${expected.toFixed(2)}, got ${actual.toFixed(2)}`);
});

test('RMD at 80 uses divisor 20.2', () => {
  const expected = 1_000_000 / 20.2;
  const actual = calculateRMD(1_000_000, 80);
  assert.ok(Math.abs(actual - expected) < 0.01);
});

test('RMD increases as a percentage with age', () => {
  // Sanity: RMD/balance should be monotonically increasing.
  let prev = 0;
  for (let age = 73; age <= 95; age++) {
    const rmd = calculateRMD(1_000_000, age);
    assert.ok(rmd > prev, `age ${age}: ${rmd} should exceed age ${age - 1}: ${prev}`);
    prev = rmd;
  }
});

test('isRMDAge boundary', () => {
  assert.equal(isRMDAge(72), false);
  assert.equal(isRMDAge(73), true);
  assert.equal(isRMDAge(100), true);
});

test('RMD with zero balance is zero', () => {
  assert.equal(calculateRMD(0, 80), 0);
  assert.equal(calculateRMD(-100, 80), 0);
});

// ============================================================================
// Account-aware tax model
// ============================================================================
console.log('\n  -- Account-aware tax --');

test('Roth IRA in growth bucket pays 0% tax', () => {
  const accounts = [makeAccount('roth', 'roth_ira')];
  const holdings = [makeHolding('growth', 5_000_000, 'roth')];
  const proj = runProjection(baseProfile, baseConfig, holdings, { accounts });
  const growthYr = proj.find(y => y.withdrawalPhase.includes('Growth') && y.withdrawalNeeded > 0);
  assert.ok(growthYr, 'expected growth phase');
  // With 100% Roth, gross should equal net (no tax).
  assert.ok(Math.abs(growthYr.grossWithdrawal - growthYr.withdrawalNeeded) < 1, 'Roth should have ~0% effective tax');
  assert.ok(growthYr.taxOnWithdrawal < 1, 'Tax should be ~0');
});

test('Traditional IRA in growth bucket pays full ordinary income', () => {
  const accounts = [makeAccount('trad', 'traditional_ira')];
  const holdings = [makeHolding('growth', 5_000_000, 'trad')];
  const proj = runProjection(baseProfile, baseConfig, holdings, { accounts });
  const growthYr = proj.find(y => y.withdrawalPhase.includes('Growth') && y.withdrawalNeeded > 0);
  assert.ok(growthYr, 'expected growth phase');
  // 22% federal + 5% state = 27%; gross = net / 0.73
  const expectedGross = growthYr.withdrawalNeeded / 0.73;
  assert.ok(Math.abs(growthYr.grossWithdrawal - expectedGross) < 5, `expected ~${expectedGross}, got ${growthYr.grossWithdrawal}`);
});

test('50/50 Roth/Traditional gives roughly half the tax', () => {
  const accounts = [makeAccount('roth', 'roth_ira'), makeAccount('trad', 'traditional_ira')];
  const holdings = [
    makeHolding('growth', 2_500_000, 'roth'),
    makeHolding('growth', 2_500_000, 'trad'),
  ];
  const proj = runProjection(baseProfile, baseConfig, holdings, { accounts });
  const growthYr = proj.find(y => y.withdrawalPhase.includes('Growth') && y.withdrawalNeeded > 0);
  assert.ok(growthYr, 'expected growth phase');
  // Effective rate ~13.5% (half of 27%)
  const expectedGross = growthYr.withdrawalNeeded / (1 - 0.135);
  assert.ok(Math.abs(growthYr.grossWithdrawal - expectedGross) < 10, `mixed tax: expected ~${expectedGross}, got ${growthYr.grossWithdrawal}`);
});

test('No accounts param falls back to legacy behavior', () => {
  // Same holdings, no accounts → legacy fed+state for growth phase.
  const holdings = [makeHolding('growth', 5_000_000)];
  const proj = runProjection(baseProfile, baseConfig, holdings);
  const growthYr = proj.find(y => y.withdrawalPhase.includes('Growth') && y.withdrawalNeeded > 0);
  assert.ok(growthYr, 'expected growth phase');
  const expectedGross = growthYr.withdrawalNeeded / 0.73;
  assert.ok(Math.abs(growthYr.grossWithdrawal - expectedGross) < 5);
});

// ============================================================================
// Monte Carlo
// ============================================================================
console.log('\n  -- Monte Carlo --');

test('success rate is between 0 and 1', () => {
  const holdings = [makeHolding('cash', 200_000), makeHolding('bridge', 600_000), makeHolding('growth', 1_500_000)];
  const result = runMonteCarlo(baseProfile, baseConfig, holdings, [], { trials: 100, seed: 42 });
  assert.ok(result.successRate >= 0 && result.successRate <= 1, `successRate=${result.successRate}`);
});

test('percentiles are ordered: p5 <= p50 <= p95', () => {
  const holdings = [makeHolding('cash', 200_000), makeHolding('bridge', 600_000), makeHolding('growth', 1_500_000)];
  const result = runMonteCarlo(baseProfile, baseConfig, holdings, [], { trials: 200, seed: 42 });
  assert.ok(result.percentiles.p5 <= result.percentiles.p50, `p5 ${result.percentiles.p5} > p50 ${result.percentiles.p50}`);
  assert.ok(result.percentiles.p50 <= result.percentiles.p95, `p50 > p95`);
  // Same for any year band
  for (const yr of result.byYear) {
    assert.ok(yr.p5 <= yr.p25 && yr.p25 <= yr.p50 && yr.p50 <= yr.p75 && yr.p75 <= yr.p95,
      `year ${yr.year} percentiles out of order`);
  }
});

test('seed produces deterministic results', () => {
  const holdings = [makeHolding('growth', 1_000_000)];
  const a = runMonteCarlo(baseProfile, baseConfig, holdings, [], { trials: 100, seed: 7 });
  const b = runMonteCarlo(baseProfile, baseConfig, holdings, [], { trials: 100, seed: 7 });
  assert.equal(a.successRate, b.successRate, 'seeded MC should reproduce');
  assert.equal(a.percentiles.p50, b.percentiles.p50);
});

test('higher portfolio = higher success rate (sanity)', () => {
  const small = [makeHolding('cash', 100_000)];
  const large = [makeHolding('cash', 200_000), makeHolding('bridge', 600_000), makeHolding('growth', 1_500_000)];
  const r1 = runMonteCarlo(baseProfile, baseConfig, small, [], { trials: 200, seed: 1 });
  const r2 = runMonteCarlo(baseProfile, baseConfig, large, [], { trials: 200, seed: 1 });
  assert.ok(r2.successRate > r1.successRate,
    `bigger portfolio should beat smaller (${r1.successRate} vs ${r2.successRate})`);
});

test('zero volatility approximates deterministic projection', () => {
  // With vol=0, MC should produce ~identical paths to the deterministic engine.
  const holdings = [makeHolding('cash', 200_000), makeHolding('bridge', 600_000), makeHolding('growth', 1_500_000)];
  const det = runProjection(baseProfile, baseConfig, holdings);
  const detFinal = det[det.length - 1].totalPortfolio;
  const result = runMonteCarlo(baseProfile, baseConfig, holdings, [], {
    trials: 50, seed: 1, cashVol: 0, bridgeVol: 0, growthVol: 0,
  });
  // Median should match deterministic within 1%.
  const diff = Math.abs(result.percentiles.p50 - detFinal) / Math.max(1, detFinal);
  assert.ok(diff < 0.01, `MC median (${result.percentiles.p50}) should match deterministic (${detFinal}); diff ${(diff*100).toFixed(2)}%`);
});

test('byYear array has one entry per projected year', () => {
  const holdings = [makeHolding('cash', 1_000_000)];
  const result = runMonteCarlo(baseProfile, baseConfig, holdings, [], { trials: 50, seed: 1 });
  const expectedYears = baseProfile.lifeExpectancy - baseProfile.currentAge + 1;
  assert.equal(result.byYear.length, expectedYears, `expected ${expectedYears} years, got ${result.byYear.length}`);
});

test('default volatilities are sensible', () => {
  assert.ok(DEFAULT_VOL.cash < DEFAULT_VOL.bridge, 'cash should be less volatile than bridge');
  assert.ok(DEFAULT_VOL.bridge < DEFAULT_VOL.growth, 'bridge should be less volatile than growth');
});

// ============================================================================
// Integration: RMD via projection
// ============================================================================
console.log('\n  -- Integration --');

test('projection records rmdRequired at age 73+', () => {
  // Use older profile so we hit RMD years quickly.
  const oldProfile: UserProfile = { ...baseProfile, currentAge: 70, retirementAge: 70, lifeExpectancy: 85 };
  const accounts = [makeAccount('trad', 'traditional_ira')];
  const holdings = [makeHolding('growth', 2_000_000, 'trad')];
  const proj = runProjection(oldProfile, baseConfig, holdings, { accounts });
  const at73 = proj.find(y => y.age === 73);
  const at72 = proj.find(y => y.age === 72);
  assert.ok(at73, 'need year at 73');
  assert.ok(at72, 'need year at 72');
  assert.equal(at72.rmdRequired, 0, 'no RMD at 72');
  assert.ok(at73.rmdRequired > 0, `expected positive RMD at 73, got ${at73.rmdRequired}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
