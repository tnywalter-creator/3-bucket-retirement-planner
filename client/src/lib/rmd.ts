/**
 * Required Minimum Distributions (RMDs) for Traditional IRA / 401(k) / 403(b) / etc.
 *
 * Under SECURE Act 2.0 (effective 2023), RMDs begin at age 73. Roth IRAs are exempt
 * during the owner's lifetime. HSAs are exempt. Taxable brokerage accounts have no RMD.
 *
 * Source: IRS Uniform Lifetime Table (Publication 590-B, Appendix B, Table III).
 * RMD = traditional retirement balance (prior 12/31) / divisor for current age.
 */

// IRS Uniform Lifetime Table — divisors by age. Truncated/extrapolated for ages 116+.
// Each entry: divisor used to compute RMD for that age.
const UNIFORM_LIFETIME_TABLE: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2,
  81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7,
  89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5,  95: 8.9,  96: 8.4,
  97: 7.8,  98: 7.3,  99: 6.8,  100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9,
  105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3,
  113: 3.1, 114: 3.0, 115: 2.9,
};

/** Age at which RMDs become required under SECURE Act 2.0 (rises to 75 for those born 1960+). */
export const RMD_START_AGE = 73;

/** Returns the RMD for the given age and traditional retirement balance. 0 if age < 73. */
export function calculateRMD(traditionalBalance: number, age: number): number {
  if (age < RMD_START_AGE || traditionalBalance <= 0) return 0;
  const divisor = UNIFORM_LIFETIME_TABLE[age] ?? UNIFORM_LIFETIME_TABLE[115];
  return traditionalBalance / divisor;
}

/** Whether an RMD is required at this age. */
export function isRMDAge(age: number): boolean {
  return age >= RMD_START_AGE;
}
