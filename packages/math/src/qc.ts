/**
 * Continuing Calibration Verification (CCV) / calibration standard check:
 *   recovery (%) = measured / expected * 100
 * Guard: expected === 0 -> throw.
 */
export function ccvRecovery(measured: number, expected: number): number {
  throw new Error('Not implemented: ccvRecovery');
}

/**
 * Matrix spike recovery:
 *   recovery (%) = (spikedMeasured - unspikedMeasured) / spikeAdded * 100
 * Guard: spikeAdded === 0 -> throw.
 */
export function spikeRecovery(spikedMeasured: number, unspikedMeasured: number, spikeAdded: number): number {
  throw new Error('Not implemented: spikeRecovery');
}

/**
 * Relative Percent Difference:
 *   RPD = |s1 - s2| / ((s1 + s2) / 2) * 100
 * Guard: mean <= 0 -> return null (undefined, BUKAN Infinity/NaN).
 */
export function relativePercentDifference(s1: number, s2: number): number | null {
  throw new Error('Not implemented: relativePercentDifference');
}
