import type { Point, Regression } from './types';

/**
 * Ordinary Least Squares linear regression, dihitung dengan rumus TERPUSAT
 * (mean-subtracted) untuk menghindari catastrophic cancellation pada dynamic
 * range ICP-MS (Invariant A2 / Layer -1).
 *
 * Model: y = slope * x + intercept
 *
 * Guards (WAJIB):
 * - points.length < 3  -> throw (df = n - 2 harus >= 1)
 * - sxx === 0 (semua x identik) -> throw
 *
 * Rumus:
 *   xMean = Σx / n ; yMean = Σy / n
 *   sxx   = Σ(x - xMean)^2
 *   syy   = Σ(y - yMean)^2
 *   sxy   = Σ(x - xMean)(y - yMean)
 *   slope = sxy / sxx
 *   intercept = yMean - slope * xMean
 *   ssRes = syy - slope * sxy
 *   syx   = sqrt(ssRes / (n - 2))
 *   r     = sxy / sqrt(sxx * syy)   (r = 0 bila syy === 0)
 */
export function linearRegression(points: Point[]): Regression {
  // check point length
  if (points.length < 3) {
    throw new Error('Titik harus diatas 3')
  }

  // calculate mean
  const n = points.length
  const xMean = points.reduce((acc, p) => acc + p.x, 0) / n
  const yMean = points.reduce((acc, p) => acc + p.y, 0) / n

  // calculate sum
  let sxx = 0
  let sxy = 0
  let syy = 0

  for (const p of points) {
    const dx = p.x - xMean
    const dy = p.y - yMean

    sxx += dx * dx
    sxy += dy * dy
    syy += dx * dy
  }

  // guard sxx
  if (sxx === 0) {
    throw new Error('slope cannot be calculated, x value is constant')
  }

  const slope = sxy / sxx
  const intercept = yMean - slope * xMean
  const ssRes = syy - slope * sxy
  const syx = Math.sqrt(ssRes / (n - 2))
  const r = sxy / Math.sqrt(sxx * syy)

  return {
    n,
    intercept,
    r,
    rSquared,
    slope,
    syx,
    sxx
  }
}

/**
 * Koefisien korelasi Pearson dari dua array.
 * Guard: panjang array harus sama & >= 2; denom 0 -> 0.
 */
export function pearsonR(xs: number[], ys: number[]): number {
  throw new Error('Not implemented: pearsonR');
}

/**
 * Invariant D1: deret kalibrasi wajib punya minimal `minNonZeroLevels`
 * konsentrasi non-zero (default 5; screening kualitatif boleh 3).
 * Throw bila kurang.
 */
export function assertMinNonZeroLevels(points: Point[], minNonZeroLevels = 5): void {
  throw new Error('Not implemented: assertMinNonZeroLevels');
}
