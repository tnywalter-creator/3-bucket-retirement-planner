/**
 * Monte Carlo simulation for retirement portfolio outcomes.
 *
 * Runs many trials of the projection engine with returns drawn from a normal
 * distribution. Reports success rate (portfolio > 0 at life expectancy) and
 * percentile bands (5th / 50th / 95th) of total portfolio by year.
 *
 * Limitations:
 *   - Returns are sampled independently each year (no autocorrelation, no fat tails).
 *   - Inflation is treated as deterministic (worth making stochastic in a future round).
 *   - Bucket returns are sampled independently (real markets are correlated; bonds
 *     and stocks move together more than this assumes).
 *
 * Even with those simplifications, a stochastic model is dramatically more
 * informative than a deterministic one for retirement planning.
 */

import { runProjection, YearProjection } from './engine';
import type { UserProfile, BucketConfig, Holding, Account } from './types';

/** Default annualized standard deviations — industry rough cuts. */
export const DEFAULT_VOL = {
  cash: 0.005,    // 0.5% — HYSA / MMF have near-zero vol
  bridge: 0.08,   // 8% — 60/40 mix
  growth: 0.16,   // 16% — broad equities
};

export interface MonteCarloOptions {
  trials?: number;
  cashVol?: number;
  bridgeVol?: number;
  growthVol?: number;
  /** Seed for reproducible runs in tests. Omit for nondeterministic. */
  seed?: number;
}

export interface MonteCarloResult {
  trials: number;
  /** Percent of trials where the portfolio survives to lifeExpectancy. */
  successRate: number;
  /** Worst, median, best final-balance trials. */
  percentiles: {
    p5: number;
    p50: number;
    p95: number;
  };
  /** For each year, percentile total portfolio across trials. */
  byYear: Array<{
    year: number;
    age: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  }>;
  /** Trials in which the portfolio depleted before life expectancy. */
  depletionAges: number[];
}

/** Tiny mulberry32 PRNG — deterministic when seeded. */
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller transform: turns two uniforms into one standard normal. */
function gaussian(rand: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

export function runMonteCarlo(
  profile: UserProfile,
  bucketConfig: BucketConfig,
  holdings: Holding[],
  accounts: Account[] | undefined,
  opts: MonteCarloOptions = {},
): MonteCarloResult {
  const trials = opts.trials ?? 1000;
  const cashVol = opts.cashVol ?? DEFAULT_VOL.cash;
  const bridgeVol = opts.bridgeVol ?? DEFAULT_VOL.bridge;
  const growthVol = opts.growthVol ?? DEFAULT_VOL.growth;
  const rand = opts.seed != null ? mulberry32(opts.seed) : Math.random;

  const yearsToProject = profile.lifeExpectancy - profile.currentAge + 1;
  const cashMu = bucketConfig.cashReturn / 100;
  const bridgeMu = bucketConfig.bridgeReturn / 100;
  const growthMu = bucketConfig.growthReturn / 100;

  // Per-year arrays: [year][trial] = total portfolio
  const portfolioByYear: number[][] = Array.from({ length: yearsToProject }, () => []);
  const finalBalances: number[] = [];
  const depletionAges: number[] = [];
  let successes = 0;

  for (let t = 0; t < trials; t++) {
    const cash = new Array(yearsToProject);
    const bridge = new Array(yearsToProject);
    const growth = new Array(yearsToProject);
    for (let y = 0; y < yearsToProject; y++) {
      cash[y] = cashMu + cashVol * gaussian(rand);
      bridge[y] = bridgeMu + bridgeVol * gaussian(rand);
      growth[y] = growthMu + growthVol * gaussian(rand);
    }

    const proj = runProjection(profile, bucketConfig, holdings, {
      accounts,
      returnOverrides: { cash, bridge, growth },
    });

    proj.forEach((row, idx) => portfolioByYear[idx]?.push(row.totalPortfolio));

    const final = proj[proj.length - 1]?.totalPortfolio ?? 0;
    finalBalances.push(final);

    const depletion = proj.find(r => r.totalPortfolio <= 0);
    if (depletion) depletionAges.push(depletion.age);

    if (final > 0) successes++;
  }

  finalBalances.sort((a, b) => a - b);
  const byYear = portfolioByYear.map((vals, idx) => {
    const sorted = [...vals].sort((a, b) => a - b);
    return {
      year: new Date().getFullYear() + idx,
      age: profile.currentAge + idx,
      p5: pct(sorted, 0.05),
      p25: pct(sorted, 0.25),
      p50: pct(sorted, 0.50),
      p75: pct(sorted, 0.75),
      p95: pct(sorted, 0.95),
    };
  });

  return {
    trials,
    successRate: trials > 0 ? successes / trials : 0,
    percentiles: {
      p5: pct(finalBalances, 0.05),
      p50: pct(finalBalances, 0.50),
      p95: pct(finalBalances, 0.95),
    },
    byYear,
    depletionAges,
  };
}

/** Helper for the dashboard. Smaller trial count for snappy dashboard refresh. */
export function quickSuccessProbability(
  profile: UserProfile,
  bucketConfig: BucketConfig,
  holdings: Holding[],
  accounts?: Account[],
): number {
  return runMonteCarlo(profile, bucketConfig, holdings, accounts, { trials: 250 }).successRate;
}

// runProjection's YearProjection is re-exported for ease of use by callers.
export type { YearProjection };
