import type { SolutionConcUnit, SolidResultUnit, VolumeUnit, WeightUnit } from './types';

export interface SolidConversionParams {
  volume: number;
  volumeUnit: VolumeUnit;
  df: number;
  weight: number;
  weightUnit: WeightUnit;
  solutionConcUnit: SolutionConcUnit;
  solidResultUnit: SolidResultUnit;
}

export interface DetectionLimitOptions {
  /** Pengali untuk LOD (default 3, Kaiser). */
  kLod?: number;
  /** Pengali untuk LOQ (default 10, Currie). */
  kLoq?: number;
}

/**
 * LOD/LOQ instrumen di vial (dalam solutionConcUnit):
 *   lod = kLod * syx / slope
 *   loq = kLoq * syx / slope
 * Guard: slope <= 0 -> throw.
 */
export function instrumentDetectionLimits(
  slope: number,
  syx: number,
  options?: DetectionLimitOptions,
): { lod: number; loq: number } {
  throw new Error('Not implemented: instrumentDetectionLimits');
}

/**
 * Konversi konsentrasi larutan (solutionConcUnit) -> konsentrasi padatan
 * (solidResultUnit), UNIT-AWARE. DILARANG meng-hardcode /1000.
 *
 * Dimensi:
 *   mgAnalyte = toMgPerL(solutionConc) * toLiters(volume) * df
 *   kgSample  = toKg(weight)
 *   baseMgPerKg = mgAnalyte / kgSample
 *   return fromMgPerKg(baseMgPerKg) dalam solidResultUnit
 *
 * Faktor (untuk verifikasi):
 *   ppm -> x1 ; ppb -> x1e-3 ; ppt -> x1e-6   (menuju mg/L)
 *   mL -> x1e-3 ; L -> x1                (menuju L)
 *   g  -> x1e-3 ; mg -> x1e-6            (menuju kg)
 *   mg/kg -> x1 ; ug/kg -> x1e3 ; percent -> x1e-4
 *
 * Guard: weight <= 0 -> throw.
 */
export function toSolidConcentration(solutionConc: number, params: SolidConversionParams): number {
  throw new Error('Not implemented: toSolidConcentration');
}
