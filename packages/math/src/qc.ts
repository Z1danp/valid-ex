/**
 * Continuing Calibration Verification (CCV) / calibration standard check:
 *   recovery (%) = measured / expected * 100
 * Guard: expected === 0 -> throw.
 */
export function ccvRecovery(measured: number, expected: number): number {
  if (expected === 0) {
    throw new Error('Expected cannot be 0')
  }
  return (measured / expected) * 100;
}

/**
 * Matrix spike recovery:
 *   recovery (%) = (spikedMeasured - unspikedMeasured) / spikeAdded * 100
 * Guard: spikeAdded === 0 -> throw.
 */
export function spikeRecovery(spikedMeasured: number, unspikedMeasured: number, spikeAdded: number): number {
  if (spikeAdded === 0) {
    throw new Error('Spike added cannot be 0')
  }
  return ((spikedMeasured - unspikedMeasured) / spikeAdded) * 100
}

/**
 * Relative Percent Difference:
 *   RPD = |s1 - s2| / ((s1 + s2) / 2) * 100
 * Guard: mean <= 0 -> return null (undefined, BUKAN Infinity/NaN).
 */
export function relativePercentDifference(s1: number, s2: number): number | null {
  const mean = (s1 + s2) / 2
  if (mean <= 0) {
    return null
  }
  return (Math.abs(s1 - s2) / mean) * 100
}
