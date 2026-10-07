import type { AnalyteCriteria, CalibrationInput, AnalyteSampleResult, CalibrationOutput, CurveMetrics, Point, QCStatus, QCViolation } from './types';
import { resolveAnalyteCriteria, validateProfile, assertMinNonZeroLevels, linearRegression, instrumentDetectionLimits, inverseConcentration, classifyZone, toSolidConcentration, formatReportedValue, ccvRecovery, spikeRecovery, relativePercentDifference } from './index'

/**
 * Orkestrator utama (ADR-0003: isomorphic zero-drift).
 *
 * Alur:
 * 1. Validasi profil (validateProfile) & resolve kriteria per analit.
 * 2. Bangun kurva OLS per analit dari standards (x=nominalConc, y=signal).
 *    - assertMinNonZeroLevels (D1).
 *    - Hitung CurveMetrics: slope/intercept/r/rSquared/syx + lod/loq instrumen.
 * 3. Cari blanko metode (sampleType 'blank_method') per analit -> C_blank.
 * 4. Untuk setiap baris sampel x analit:
 *    - cRaw: mode A -> inverseConcentration(signal); mode B -> readings[analyte].
 *    - cNet = cRaw - C_blank.
 *    - classifyZone(cNet, lodInstrument, loqInstrument).
 *    - lodMethod/loqMethod per sampel via toSolidConcentration.
 *    - concSolid hanya bila VALID_QUANTIFICATION.
 *    - reportedValue via formatReportedValue.
 *    - ccvRecovery: untuk 'ccv' -> ccvRecovery(cRaw, expectedConc) (larutan kontrol, tidak dikoreksi blanko).
 *    - spikeRecovery: untuk 'spike' (link parentSampleId) -> spikeRecovery(cNet_spiked, cNet_unspiked, spikeAdded).
 *    - rpd: untuk 'duplicate' (link parentSampleId) -> relativePercentDifference(cNet_pair).
 * 5. Evaluasi QC memakai band terpilih (selectRecoveryBand/selectRpdBand):
 *    - LINEARITY_R  : r < profile.linearity.minR
 *    - CCV_RECOVERY : recovery di luar band[a].minRecovery..maxRecovery
 *    - SPIKE_RECOVERY, DUPLICATE_RPD analog.
 *    - Push QCViolation (dengan profileVersion + appliedCriteria).
 * 6. qcStatus = violations.length ? 'INVALID_QC' : 'PASSED' (soft-flag; TIDAK throw).
 *
 * Analit independen (Invariant D2): hasil tiap analit tidak saling mempengaruhi.
 */
export function evaluateCalibration(input: CalibrationInput): CalibrationOutput {
  const qcViolations: QCViolation[] = []
  const criteriaByAnalyte: Record<string, AnalyteCriteria> = {}
  const analytesSummary: Record<string, CurveMetrics> = {}

  // validasi profile
  validateProfile(input.qcProfile);
  // resolve kriteria per analit
  for (const analyte of input.analytes) {
    criteriaByAnalyte[analyte] = resolveAnalyteCriteria(input.qcProfile, analyte);
    // Build OLS Curve
    // Transforms input standards into x and y format to preparation for calculate the curve calibrations
    const points: Point[] = input.standards.filter((standard) => standard.readings[analyte] !== undefined).map((standard) => {
      const reading = standard.readings[analyte]!
      if (reading.nominalConc === null || reading.signal === null) {
        throw new Error(`Analyte '${analyte}' has null nominalConc or signal at ${standard.standardName}`)
      }
      return {
        x: reading.nominalConc,
        y: reading.signal
      }
    });
    // checking minimum non-zero levels
    assertMinNonZeroLevels(points)
    // calculate regression 
    const reg = linearRegression(points)
    // cek linearity
    if (reg.r < input.qcProfile.linearity.minR) {
      qcViolations.push({
        rule: 'LINEARITY_R',
        analyte,
        sampleId: null,
        expected: `r >= ${input.qcProfile.linearity.minR}`,
        actual: `r = ${reg.r}`,
        message: `Linearity r (${reg.r}) is below minimum ${input.qcProfile.linearity.minR}`,
        profileVersion: input.qcProfile.version,
        appliedCriteria: {
          testValue: reg.r,
          bandMaxConc: null,
          min: input.qcProfile.linearity.minR,
          max: null
        }
      })
    }
    // Calculate instrument LOD and LOQ
    const { lod: lodInstrument, loq: loqInstrument } = instrumentDetectionLimits(reg.slope, reg.syx);
    analytesSummary[analyte] = {
      ...reg,
      lodInstrument,
      loqInstrument
    }

    // cek blanko metode (sampleType 'blank_method') per analit -> C_blank.
    const methodBlank = input.samples.find((sample) => sample.sampleType === 'blank_method');

    // if no blank
    if (!methodBlank) {
      throw new Error(`Batch must contain at least one sample with sampleType 'blank_method'`);
    }

    // if analyte reading is missing in blank
    const blankReading = methodBlank.readings[analyte];
    if (blankReading === undefined || blankReading === null) {
      throw new Error(`Blank method sample is missing reading for analyte '${analyte}'`);
    }



    // calculate C_net for each sample
    for (const sample of input.samples) {
      // initialize sample analytes
      const sampleAnalytes: Record<string, AnalyteSampleResult> = {};

      const reg = analytesSummary[analyte];
      // calculate C_blank based on input mode
      const cBlank = input.inputMode === 'raw_signal' ? inverseConcentration(blankReading, reg.slope, reg.intercept) : blankReading;
      // calculate C_raw based on input mode
      const cRaw = input.inputMode === 'raw_signal' ? inverseConcentration(sample.readings[analyte]!, reg.slope, reg.intercept) : sample.readings[analyte];

      const cNet = cRaw! - cBlank;

      // calculate detection Zone
      const zone = classifyZone(cNet, reg.lodInstrument, reg.loqInstrument);

      // Konversi unit
      const conversionParams = {
        volume: sample.volume,
        volumeUnit: input.units.volumeUnit,
        df: sample.df,
        weight: sample.weight,
        weightUnit: input.units.weightUnit,
        solutionConcUnit: input.units.solutionConcUnit,
        solidResultUnit: input.units.solidResultUnit
      }

      // get LoD/LoQ instrumen
      const { lodInstrument, loqInstrument } = analytesSummary[analyte]

      const lodMethod = toSolidConcentration(lodInstrument, conversionParams);
      const loqMethod = toSolidConcentration(loqInstrument, conversionParams);

      // cek zone 
      const concSolid = zone === 'VALID_QUANTIFICATION' ? toSolidConcentration(cNet, conversionParams) : null;

      const reportedValue = formatReportedValue({
        zone,
        concSolid,
        loqMethod,
        solidResultUnit: input.units.solidResultUnit
      })

      // cek ccv recovery
      if (sample.sampleType === 'ccv') {
        const ccvRecoveryValue = ccvRecovery(cRaw!, sample.expectedConc![analyte]!);
      }

      if (sample.sampleType === 'spike') {
        const parentSample = input.samples.find((s) => s.sampleId === sample.parentSampleId)

        if (!parentSample) {
          throw new Error(`Parent sample ${sample.parentSampleId} not found`)
        }
        // cek spike recovery
        const parentReading = parentSample.readings[analyte]
        if (parentReading === undefined || parentReading === null) {
          throw new Error(`Parent sample ${sample.parentSampleId} is missing reading for analyte '${analyte}'`)
        }
        // get unspike from parent sample
        const cRawParent = input.inputMode === 'raw_signal' ? inverseConcentration(parentReading, reg.slope, reg.intercept) : parentReading
        // get spikeAdded for this analyte
        const added = sample.spikeAdded?.[analyte]
        if (added === undefined || added === null) {
          throw new Error(`Sample ${sample.sampleId} is missing spikeAdded for analyte '${analyte}'`)
        }

        const spikeRecoveryValue = spikeRecovery(cRaw!, cRawParent!, added!)

        
      }


    }
  }
  return {
    qcStatus: qcViolations.length > 0 ? 'INVALID_QC' : 'PASSED',
    qcViolations: qcViolations,
    analytesSummary: analytesSummary,
    evaluatedSamples: []
  }
}
