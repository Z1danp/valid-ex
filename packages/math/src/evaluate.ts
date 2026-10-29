import type { AnalyteCriteria, CalibrationInput, AnalyteSampleResult, CalibrationOutput, CurveMetrics, Point, QCStatus, QCViolation, EvaluatedSampleRow } from './types';
import { selectRecoveryBand, resolveAnalyteCriteria, validateProfile, assertMinNonZeroLevels, linearRegression, instrumentDetectionLimits, inverseConcentration, classifyZone, toSolidConcentration, formatReportedValue, ccvRecovery, spikeRecovery, relativePercentDifference, type SolidConversionParams, selectRpdBand } from './index'

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
 *
 * -------------------------------------------------------------------------
 * STATUS IMPLEMENTASI (todo kerjaan kamu):
 * [x] 1. validateProfile + cari blanko metode
 * [x] 2. kurva OLS per analit + assertMinNonZeroLevels + soft-flag LINEARITY_R
 * [x] 3. LOD/LOQ instrumen + C_blank (mode-aware) + isi analyteContext
 * [~] 4. sample evaluation: cRaw/cNet/zone/lodMethod/loqMethod/concSolid (WIP)
 * [ ] 4a. Pisah loop: PASS 1 (analit) lalu PASS 2 (sample luar × analit dalam)
 * [ ] 4b. Jangan skip sampleType !== 'sample' — proses blank/ccv/spike/dup juga
 * [ ] 4c. formatReportedValue → reportedValue
 * [ ] 4d. Assign AnalyteSampleResult ke analytesResult[analyte]
 * [ ] 4e. Push EvaluatedSampleRow ke evaluatedSamples
 * [ ] 4f. analytesSummary[analyte] = metrics (sekarang masih {})
 * [ ] 5. QC numerik: ccvRecovery / spikeRecovery / RPD (+ parentSampleId)
 * [ ] 5b. Soft-flag band: selectRecoveryBand / selectRpdBand → push QCViolation
 * [ ] 6. Return sudah ada; pastikan semua field terisi lalu pnpm test:math
 * -------------------------------------------------------------------------
 */
export function evaluateCalibration(input: CalibrationInput): CalibrationOutput {
  // =========================================================================
  // SETUP BATCH — sudah dikerjakan
  // Validasi profil QC + wajib ada blanko metode (sampel preparasi, BUKAN blank standar kurva).
  // =========================================================================
  validateProfile(input.qcProfile)
  const methodBlank = input.samples.find((s) => s.sampleType === 'blank_method')
  if (!methodBlank) {
    throw new Error("Batch must contain at least one sample with sampleType blank method")
  }

  // Akumulator hasil akhir + konteks per analit (criteria, metrics kurva, C_blank)
  const qcViolations: QCViolation[] = []
  const analytesSummary: Record<string, CurveMetrics> = {};
  const analyteContext: Record<string, {
    criteria: AnalyteCriteria;
    metrics: CurveMetrics;
    cBlank: number;
  }> = {};
  const evaluatedSamples: EvaluatedSampleRow[] = []

  // =========================================================================
  // PASS 1: KURVA + C_BLANK PER ANALIT — sudah dikerjakan
  // TODO nanti: setelah blok ini selesai, TUTUP loop analit di sini.
  //             Sample evaluation (PASS 2) harus di LUAR loop ini
  //             (sample luar → analit dalam), supaya 1 EvaluatedSampleRow
  //             berisi semua analit sekaligus.
  // =========================================================================
  for (const analyte of input.analytes) {
    const criteria = resolveAnalyteCriteria(input.qcProfile, analyte);

    // Standards: readings[analyte] = { nominalConc, signal } → Point { x, y }
    // (beda dari sampel: readings[analyte] di sampel sudah number langsung)
    const points: Point[] = input.standards.filter((s) => s.readings[analyte] !== undefined).map((s) => {
      const reading = s.readings[analyte]

      if (reading === undefined || reading.nominalConc === null || reading.signal === null) {
        throw new Error(`Invalid standard point for analyte ${analyte}: nominalConc or signal is null`)
      }

      return {
        x: reading.nominalConc,
        y: reading.signal
      }
    })

    // Invariant D1: minimal 5 level non-zero + blank standar di deret kalibrasi
    assertMinNonZeroLevels(points)
    const reg = linearRegression(points)

    // Soft-flag linearitas — jangan throw, cukup catat QCViolation
    const minR = input.qcProfile.linearity.minR;
    if (reg.r < minR) {
      qcViolations.push({
        rule: 'LINEARITY_R',
        analyte,
        actual: `r = ${reg.r}`,
        appliedCriteria: {
          bandMaxConc: null,
          max: null,
          min: minR,
          testValue: reg.r
        },
        expected: `r >= ${minR}`,
        message: "Linearity correlation (r) must be greater than or equal to the minimum R specified in the QC profile.",
        profileVersion: input.qcProfile.version,
        sampleId: null
      })
    }

    // LOD/LOQ instrumen di vial (solutionConcUnit): k * syx / slope
    // Nanti disimpan di CurveMetrics / analytesSummary — beda dari lodMethod (padatan per sampel)
    const lodLoQInstrument = instrumentDetectionLimits(reg.slope, reg.syx)

    // C_blank dari blanko metode: readings = number (bukan { signal })
    // mode A (raw_signal) → inverse ke konsentrasi; mode B → pakai angka langsung
    const blankReading = methodBlank.readings[analyte]
    if (blankReading === undefined || blankReading === null) {
      throw new Error(`Blank method for analyte ${analyte} is not found`)
    }

    const cBlank = input.inputMode === 'raw_signal' ? inverseConcentration(blankReading, reg.slope, reg.intercept) : blankReading

    // Simpan konteks supaya PASS 2 tinggal pakai (jangan hitung ulang kurva)
    analyteContext[analyte] = {
      criteria,
      metrics: {
        slope: reg.slope,
        intercept: reg.intercept,
        r: reg.r,
        rSquared: reg.rSquared,
        syx: reg.syx,
        lodInstrument: lodLoQInstrument.lod,
        loqInstrument: lodLoQInstrument.loq
      },
      cBlank: cBlank
    }

    // TODO [4f]: analytesSummary[analyte] = analyteContext[analyte].metrics
    analytesSummary[analyte] = analyteContext[analyte].metrics
  }
  // =========================================================================
  // PASS 2: SAMPLE EVALUATION — WIP (masih di dalam loop analit → perlu dipindah)
  // Alur yang sudah kamu tulis: reading → cRaw → cNet → zone → lod/loqMethod → concSolid
  // Semua angka ini nanti masuk ke evaluatedSamples[].analytes[analyte] (AnalyteSampleResult)
  // =========================================================================
  for (const sample of input.samples) {
    const analytesResult: Record<string, AnalyteSampleResult> = {};

    for (const analyte of input.analytes) {
      const criteria = analyteContext[analyte]!.criteria;
      const reading = sample.readings[analyte]
      if (reading === undefined || reading === null) {
        throw new Error(`Reading for analyte ${analyte} is not found in sample ${sample.sampleId}`)
      }

      // Larutan: cRaw (mode-aware) lalu koreksi blanko → cNet
      const cRaw = input.inputMode === 'raw_signal' ? inverseConcentration(reading, analyteContext[analyte]!.metrics.slope, analyteContext[analyte]!.metrics.intercept) : reading
      const cNet = cRaw - analyteContext[analyte]!.cBlank

      // Zona deteksi di level larutan (pakai lod/loq INSTRUMEN dari kurva)
      const zone = classifyZone(cNet, analyteContext[analyte]!.metrics.lodInstrument, analyteContext[analyte]!.metrics.loqInstrument)

      // Konversi unit: W/V/df dari SAMPLE ini + unit dari batch
      const conversionParams: SolidConversionParams = {
        volume: sample.volume,
        volumeUnit: input.units.volumeUnit,
        df: sample.df,
        weight: sample.weight,
        weightUnit: input.units.weightUnit,
        solutionConcUnit: input.units.solutionConcUnit,
        solidResultUnit: input.units.solidResultUnit
      }

      // lodMethod/loqMethod = batas metode di PADATAN untuk sampel ini (skala 1/berat)
      const lodMethod = toSolidConcentration(analyteContext[analyte]!.metrics.lodInstrument, conversionParams)
      const loqMethod = toSolidConcentration(analyteContext[analyte]!.metrics.loqInstrument, conversionParams)

      // concSolid hanya diisi kalau zone valid; selain itu null (ND / qualitative)
      const concSolid = zone === 'VALID_QUANTIFICATION' ? toSolidConcentration(cNet, conversionParams) : null

      // TODO [4c]: reportedValue = formatReportedValue({ zone, concSolid, loqMethod, solidResultUnit })
      const reportedValue = formatReportedValue({ zone, concSolid, loqMethod, solidResultUnit: conversionParams.solidResultUnit })
      // TODO [4d]: analytesResult[analyte] = { cRaw, cNet, concSolid, detectionZone: zone,
      //              reportedValue, lodMethod, loqMethod, rpd: null, spikeRecovery: null, ccvRecovery: null }
      analytesResult[analyte] = {
        cRaw,
        cNet,
        concSolid,
        detectionZone: zone,
        reportedValue,
        lodMethod,
        loqMethod,
        rpd: null,
        spikeRecovery: null,
        ccvRecovery: null,
      }
      // TODO [5]:  isi ccvRecovery / spikeRecovery / rpd sesuai sampleType (+ parent untuk spike/dup)
      // ccvRecovery
      if (sample.sampleType === 'ccv') {
        const expected = sample.expectedConc?.[analyte]
        if (expected === undefined || expected === null) {
          throw new Error(`Expected concentration for analyte ${analyte} is not found in sample ${sample.sampleId}`)
        }
        const recovery = ccvRecovery(cRaw, expected)
        analytesResult[analyte].ccvRecovery = recovery
        const band = selectRecoveryBand(criteria.ccv.bands, expected)
        if (band === null) {
          throw new Error(`Recovery band for analyte ${analyte} is not found`)
        }
        if (recovery < band.minRecovery || recovery > band.maxRecovery) {
          qcViolations.push({
            rule: 'CCV_RECOVERY',
            analyte,
            actual: `ccvRecovery = ${recovery}`,
            appliedCriteria: {
              bandMaxConc: null,
              max: band.maxRecovery,
              min: band.minRecovery,
              testValue: expected
            },
            expected: `ccvRecovery >= ${band.minRecovery} && ccvRecovery <= ${band.maxRecovery}`,
            message: "CCV recovery must be between the minimum and maximum recovery specified in the QC profile.",
            profileVersion: input.qcProfile.version,
            sampleId: sample.sampleId ?? null
          })
        }

      }

      // search parentSample
      const parentSample = input.samples.find((s) => s.sampleId === sample.parentSampleId)
      // spikeRecovery
      if (sample.sampleType === 'spike' && parentSample) {
        const cUnspikeNet = (input.inputMode === 'raw_signal' ? inverseConcentration(parentSample.readings[analyte] ?? 0, analyteContext[analyte]!.metrics.slope, analyteContext[analyte]!.metrics.intercept) : parentSample.readings[analyte] ?? 0) - analyteContext[analyte]!.cBlank
        const recovery = spikeRecovery(cNet, cUnspikeNet, sample.spikeAdded?.[analyte] ?? 0)
        analytesResult[analyte].spikeRecovery = recovery
        const band = selectRecoveryBand(criteria.spike.bands, sample.spikeAdded?.[analyte] ?? 0)
        if (band === null) {
          throw new Error(`Recovery band for analyte ${analyte} is not found`)
        }
        if (recovery < band.minRecovery || recovery > band.maxRecovery) {
          qcViolations.push({
            rule: 'SPIKE_RECOVERY',
            analyte,
            actual: `spikeRecovery = ${recovery}`,
            appliedCriteria: {
              bandMaxConc: null,
              max: band.maxRecovery,
              min: band.minRecovery,
              testValue: recovery
            },
            expected: `spikeRecovery >= ${band.minRecovery} && spikeRecovery <= ${band.maxRecovery}`,
            message: "Spike recovery must be between the minimum and maximum recovery specified in the QC profile.",
            profileVersion: input.qcProfile.version,
            sampleId: sample.sampleId ?? null
          })
        }
      }
      // rpd
      if (sample.sampleType === 'duplicate' && parentSample) {
        const cPairNet = (input.inputMode === 'raw_signal' ? inverseConcentration(parentSample.readings[analyte] ?? 0, analyteContext[analyte]!.metrics.slope, analyteContext[analyte]!.metrics.intercept) : parentSample.readings[analyte] ?? 0) - analyteContext[analyte]!.cBlank
        const rpd = relativePercentDifference(cPairNet, cNet)
        analytesResult[analyte].rpd = rpd
        const band = selectRpdBand(criteria.duplicate.bands, parentSample.readings[analyte] ?? 0)
        if (band === null) {
          throw new Error(`RPD band for analyte ${analyte} is not found`)
        }
        if (rpd !== null && rpd > band.maxRpd) {
          qcViolations.push({
            rule: 'DUPLICATE_RPD',
            analyte,
            actual: `rpd = ${rpd}`,
            appliedCriteria: {
              bandMaxConc: band.maxConc,
              max: band.maxRpd,
              min: null,
              testValue: rpd
            },
            expected: `rpd <= ${band.maxRpd}`,
            message: "RPD must be between the minimum and maximum RPD specified in the QC profile.",
            profileVersion: input.qcProfile.version,
            sampleId: sample.sampleId ?? null
          })
        }
      }
      // TODO [5b]: soft-flag band (selectRecoveryBand / selectRpdBand) → push ke qcViolations
      // soft-flag band ccvRecovery
      // TODO [4e]: setelah loop analit dalam selesai
    }
    evaluatedSamples.push({ sampleId: sample.sampleId ?? null, sampleType: sample.sampleType, parentSampleId: sample.parentSampleId ?? null, weight: sample.weight, volume: sample.volume, df: sample.df, analytes: analytesResult })
  }
  // Soft-flag: QC gagal tidak melempar — hanya status + daftar violation
  return {
    analytesSummary,
    evaluatedSamples,
    qcViolations,
    qcStatus: qcViolations.length > 0 ? 'INVALID_QC' : 'PASSED',
  }
}
