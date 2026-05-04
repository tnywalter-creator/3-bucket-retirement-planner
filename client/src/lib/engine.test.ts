/*
 * Engine smoke tests — zero dependencies, run with:
 *   npx tsx client/src/lib/engine.test.ts
 *
 * No framework on purpose: keeps this app's tooling identical to before.
 * Promote to vitest once you have more than a handful of tests.
 */

import assert from 'node:assert/strict';
import { runProjection } from './engine';
import type { UserProfile, BucketConfig, Holding, TaxConfig } from './types';

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

function approx(actual: number, expected: number, tol = 0.01, label = '') {
  const diff = Math.abs(actual - expected);
  if (diff > tol) {
    throw new Error(`${label} expected ${expected.toFixed(4)} \u00b1 ${tol}, got ${actual.toFixed(4)} (diff ${diff.toFixed(4)})`);
  }
}

const baseTax: TaxConfig = { federalRate: 22, stateRate: 5, capitalGainsRate: 15 };

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
  taxConfig: baseTax,
};

const baseConfig: BucketConfig = {
  cashReturn: 4.5,
  bridgeReturn: 6.5,
  growthReturn: 8.5,
  cashTargetYears: 3,
  bridgeTargetYears: 7,
  cashTarget: 288_000,
  bridgeTarget: 672_000,
  growthTarget: 1_384_000,
  withdrawalRate: 4.25,
};

function makeHolding(bucket: 'cash' | 'bridge' | 'growth', dollars: number): Holding {
  return {
    id: `${bucket}-${dollars}`,
    ticker: bucket.toUpperCase(),
    name: bucket,
    type: 'etf',
    quantity: dollars,
    currentPrice: 1,
    lastUpdated: new Date().toISOString(),
    accountId: 'acct-1',
    bucket,
  };
}

console.log('engine.ts tests');

// ---------- Tax math ----------

test('cash phase has 0% tax (no withholding on HYSA)', () => {
  const holdings = [makeHolding('cash', 1_000_000)];
  const proj = runProjection(baseProfile, baseConfig, holdings);
  const yr1 = proj[0];
  approx(yr1.taxOnWithdrawal, 0, 0.01, 'year-1 tax');
  approx(yr1.grossWithdrawal, yr1.withdrawalNeeded, 0.01, 'year-1 gross');
});

test('growth phase grosses up CORRECTLY (gross = net / (1 - rate))', () => {
  const holdings = [makeHolding('growth', 5_000_000)];
  const proj = runProjection(baseProfile, baseConfig, holdings);
  const growthYear = proj.find(y => y.withdrawalPhase.startsWith('Retirement Year') && y.withdrawalPhase.includes('Growth'));
  assert.ok(growthYear, 'expected to reach growth phase');
  // Combined rate = federalRate + stateRate = 27%. So gross = net / 0.73.
  const expectedGross = growthYear!.withdrawalNeeded / (1 - 0.27);
  approx(growthYear!.grossWithdrawal, expectedGross, 1, 'growth phase gross-up');
  approx(growthYear!.taxOnWithdrawal, expectedGross - growthYear!.withdrawalNeeded, 1, 'growth phase tax');
});

test('bridge phase uses cap gains + state, not full income tax', () => {
  const holdings = [makeHolding('bridge', 5_000_000)];
  const proj = runProjection(baseProfile, baseConfig, holdings);
  const bridgeYear = proj.find(y => y.withdrawalPhase.includes('Bridge') && y.withdrawalNeeded > 0);
  assert.ok(bridgeYear, 'expected to reach bridge phase');
  // Bridge effective rate = capGains + state = 20%. Gross = net / 0.80.
  const expectedGross = bridgeYear!.withdrawalNeeded / (1 - 0.20);
  approx(bridgeYear!.grossWithdrawal, expectedGross, 1, 'bridge phase gross-up');
});

test('federal + state are SUMMED, not averaged (regression for old bug)', () => {
  const holdings = [makeHolding('growth', 5_000_000)];
  const proj = runProjection(baseProfile, baseConfig, holdings);
  const growthYear = proj.find(y => y.withdrawalPhase.includes('Growth') && y.withdrawalNeeded > 0);
  assert.ok(growthYear, 'expected growth phase');
  const avgRate = (22 + 5) / 2 / 100; // 13.5% \u2014 what the bug used
  const buggyGross = growthYear!.withdrawalNeeded / (1 - avgRate);
  assert.ok(
    growthYear!.grossWithdrawal > buggyGross + 1,
    `gross ${growthYear!.grossWithdrawal.toFixed(2)} should exceed buggy gross ${buggyGross.toFixed(2)}`,
  );
});

// ---------- Projection invariants ----------

test('total portfolio is monotonically non-increasing during retirement when no growth', () => {
  const holdings = [makeHolding('cash', 100_000), makeHolding('bridge', 100_000), makeHolding('growth', 100_000)];
  const config = { ...baseConfig, cashReturn: 0, bridgeReturn: 0, growthReturn: 0 };
  const proj = runProjection(baseProfile, config, holdings);
  for (let i = 1; i < proj.length; i++) {
    assert.ok(
      proj[i].totalPortfolio <= proj[i - 1].totalPortfolio + 0.5,
      `year ${i}: portfolio went up without returns (${proj[i - 1].totalPortfolio} -> ${proj[i].totalPortfolio})`,
    );
  }
});

test('depletion is detected when funds run out', () => {
  const holdings = [makeHolding('cash', 50_000)];
  const tinyProfile: UserProfile = { ...baseProfile, monthlySpending: 5_000, socialSecurityAmount: 0, spouseSocialSecurityAmount: 0 };
  const config = { ...baseConfig, cashReturn: 0, bridgeReturn: 0, growthReturn: 0 };
  const proj = runProjection(tinyProfile, config, holdings);
  const deplete = proj.find(y => y.totalPortfolio <= 0);
  assert.ok(deplete, 'expected portfolio to deplete');
});

test('pre-retirement does not draw from buckets', () => {
  const profile: UserProfile = { ...baseProfile, currentAge: 50, retirementAge: 65 };
  const holdings = [makeHolding('cash', 100_000), makeHolding('growth', 500_000)];
  const proj = runProjection(profile, baseConfig, holdings);
  for (let i = 0; i < 15; i++) {
    assert.equal(proj[i].withdrawalNeeded, 0, `year ${i} should have zero withdrawal pre-retirement`);
    assert.equal(proj[i].grossWithdrawal, 0, `year ${i} should have zero gross pre-retirement`);
  }
});

test('inflation grows spending year over year', () => {
  const proj = runProjection(baseProfile, baseConfig, [makeHolding('cash', 1_000_000)]);
  for (let i = 1; i < 10; i++) {
    assert.ok(
      proj[i].spendingNeed > proj[i - 1].spendingNeed,
      `spending should grow with inflation (year ${i - 1}: ${proj[i - 1].spendingNeed}, year ${i}: ${proj[i].spendingNeed})`,
    );
  }
});

test('social security kicks in at the configured age', () => {
  const proj = runProjection(baseProfile, baseConfig, [makeHolding('cash', 1_000_000)]);
  const before = proj.find(y => y.age === 66);
  const at = proj.find(y => y.age === 67);
  assert.ok(before && at, 'need years 66 and 67');
  assert.equal(before!.ssIncome, 0, 'SS should be 0 at 66');
  assert.ok(at!.ssIncome > 0, 'SS should be positive at 67');
});

// ---------- Edge cases ----------

test('handles empty holdings without crashing', () => {
  const proj = runProjection(baseProfile, baseConfig, []);
  assert.ok(proj.length > 0, 'should still produce projection rows');
  assert.equal(proj[0].totalPortfolio, 0, 'first-year portfolio should be 0');
});

test('handles 100% tax config without dividing by zero', () => {
  const profile: UserProfile = { ...baseProfile, taxConfig: { federalRate: 60, stateRate: 50, capitalGainsRate: 40 } };
  const holdings = [makeHolding('growth', 5_000_000)];
  const proj = runProjection(profile, baseConfig, holdings);
  const growthYear = proj.find(y => y.withdrawalPhase.includes('Growth') && y.withdrawalNeeded > 0);
  assert.ok(growthYear, 'expected growth phase');
  assert.ok(Number.isFinite(growthYear!.grossWithdrawal), 'gross withdrawal must be finite');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
