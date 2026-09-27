import type { DetectionZone, SolidResultUnit } from './types';

/**
 * Inverse regression: konsentrasi dari sinyal.
 *   c = (signal - intercept) / slope
 * Guard: slope <= 0 -> throw.
 */
export function inverseConcentration(signal: number, slope: number, intercept: number): number {
  throw new Error('Not implemented: inverseConcentration');
}

/**
 * Klasifikasi 3-zona (Invariant D3), di level larutan:
 *   cNet <= 0 OR cNet < lod        -> NOT_DETECTED
 *   lod <= cNet < loq              -> QUALITATIVE_ONLY
 *   cNet >= loq                    -> VALID_QUANTIFICATION
 * Batas: LOD inklusif (== lod -> QUALITATIVE_ONLY), LOQ inklusif.
 */
export function classifyZone(cNet: number, lodInstrument: number, loqInstrument: number): DetectionZone {
  throw new Error('Not implemented: classifyZone');
}

export interface ReportedValueParams {
  zone: DetectionZone;
  concSolid: number | null;
  loqMethod: number;
  solidResultUnit: SolidResultUnit;
  /** Jumlah desimal untuk zona VALID_QUANTIFICATION (presentation layer, Invariant D5). Default 3. */
  decimals?: number;
}

/**
 * Format pelaporan resmi ISO 17025:
 *   NOT_DETECTED       -> "ND"
 *   QUALITATIVE_ONLY   -> "< {loqMethod} {unit}"
 *   VALID_QUANTIFICATION -> "{concSolid} {unit}"
 */
export function formatReportedValue(params: ReportedValueParams): string {
  throw new Error('Not implemented: formatReportedValue');
}
