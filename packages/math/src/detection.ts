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
};

const CONC_FACTORS: Record<SolutionConcUnit, number> = {
  ppm: 1,
  ppb: 1e-3,
  ppt: 1e-6
};

const VOL_FACTORS: Record<VolumeUnit, number> = {
  L: 1,
  mL: 1e-3
};

const WEIGHT_FACTORS: Record<WeightUnit, number> = {
  g: 1e-3,
  mg: 1e-6
}

const RESULT_FACTORS: Record<SolidResultUnit, number> = {
  "mg/kg": 1,
  "ug/kg": 1e3,
  percent: 1e-4
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
  if (slope <= 0 ) {
    throw new Error('Slope cannot be 0')
  }

  const kLod = options?.kLod ?? 3
  const kLoq = options?.kLoq ?? 10

  const lod = kLod * syx / slope
  const loq = kLoq * syx / slope

  return { lod, loq }
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
  const {volume, volumeUnit, df, weight, weightUnit, solutionConcUnit, solidResultUnit} = params
  if (weight <= 0) {
    throw new Error('Weight must be positive')
  }
  
  const mgAnalyte = solutionConc * CONC_FACTORS[solutionConcUnit] * (volume * VOL_FACTORS[volumeUnit]) * df;

  const kgSample = weight * WEIGHT_FACTORS[weightUnit];

  const baseMgPerKg = mgAnalyte / kgSample;

  return baseMgPerKg * RESULT_FACTORS[solidResultUnit]

}
