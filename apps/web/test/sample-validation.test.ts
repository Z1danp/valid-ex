import assert from 'node:assert/strict';
import test from 'node:test';
import {
  QC_SAMPLE_TYPES,
  ROUTINE_SAMPLE_TYPES,
  fillMissingCcvExpectedConc,
  getAvailableParentOptions,
  isParentAllowed,
  isPrepParamsRequired,
  parseSampleTypeFromSet,
  removeAnalyteKeyInRows,
  renameAnalyteKeysInRows,
  sanitizeSampleRow,
  syncParentReferencesOnSampleRename,
  toSampleRowInputs,
  validateBatchSamples,
  type SampleRowState,
} from '../src/features/calibration/utils/sampleValidation.ts';

function makeRow(overrides: Partial<SampleRowState>): SampleRowState {
  return {
    id: 'S1',
    labSampleId: '',
    type: 'sample',
    parent: '',
    weight: 0.2,
    vol: 50,
    df: 1,
    readings: { Cd: 1500 },
    ...overrides,
  };
}

test('isParentAllowed permits only spike and duplicate; isPrepParamsRequired skips blank_method and ccv', () => {
  assert.equal(isParentAllowed('spike'), true);
  assert.equal(isParentAllowed('duplicate'), true);
  assert.equal(isParentAllowed('sample'), false);
  assert.equal(isParentAllowed('blank_method'), false);
  assert.equal(isParentAllowed('ccv'), false);

  assert.equal(isPrepParamsRequired('blank_method'), false);
  assert.equal(isPrepParamsRequired('ccv'), false);
  assert.equal(isPrepParamsRequired('sample'), true);
  assert.equal(isPrepParamsRequired('spike'), true);
  assert.equal(isPrepParamsRequired('duplicate'), true);
});

test('sanitizeSampleRow clears parent/expectedConc/spikeAdded and sets weight/vol/df null for blank_method and ccv', () => {
  const ccvFromSpike = sanitizeSampleRow(
    makeRow({
      id: 'QC1',
      type: 'ccv',
      parent: 'S1',
      spikeAdded: { Cd: 10 },
      expectedConc: { Cd: 50 },
    }),
  );
  assert.equal(ccvFromSpike.parent, '');
  assert.equal(ccvFromSpike.weight, null);
  assert.equal(ccvFromSpike.vol, null);
  assert.equal(ccvFromSpike.df, null);
  assert.equal(ccvFromSpike.spikeAdded, undefined);
  assert.deepEqual(ccvFromSpike.expectedConc, { Cd: 50 });

  const blankFromSample = sanitizeSampleRow(
    makeRow({
      id: 'MB',
      type: 'blank_method',
      expectedConc: { Cd: 50 },
    }),
  );
  assert.equal(blankFromSample.weight, null);
  assert.equal(blankFromSample.vol, null);
  assert.equal(blankFromSample.df, null);
  assert.equal(blankFromSample.expectedConc, undefined);

  const dupFromCcv = sanitizeSampleRow(
    makeRow({
      id: 'D1',
      type: 'duplicate',
      parent: 'S1',
      weight: null,
      vol: null,
      df: null,
      expectedConc: { Cd: 50 },
    }),
  );
  assert.equal(dupFromCcv.parent, 'S1');
  assert.equal(dupFromCcv.weight, 0.2);
  assert.equal(dupFromCcv.vol, 50);
  assert.equal(dupFromCcv.df, 1);
  assert.equal(dupFromCcv.expectedConc, undefined);
});

test('parseSampleTypeFromSet isolates routine sample enum from QC enums', () => {
  assert.equal(parseSampleTypeFromSet('sample', ROUTINE_SAMPLE_TYPES, 'sample'), 'sample');
  assert.equal(parseSampleTypeFromSet('blank_method', ROUTINE_SAMPLE_TYPES, 'sample'), 'sample');
  assert.equal(parseSampleTypeFromSet(' BLANK_METHOD ', QC_SAMPLE_TYPES, 'ccv'), 'blank_method');
  assert.equal(parseSampleTypeFromSet('SPIKE', QC_SAMPLE_TYPES, 'ccv'), 'spike');
  assert.equal(parseSampleTypeFromSet('unknown', QC_SAMPLE_TYPES, 'ccv'), 'ccv');
});

test('getAvailableParentOptions returns unique sample IDs excluding blank_method', () => {
  const rows: SampleRowState[] = [
    makeRow({ id: 'MB', type: 'blank_method' }),
    makeRow({ id: ' S1 ', type: 'sample' }),
    makeRow({ id: 'S2', type: 'sample' }),
    makeRow({ id: 'S1', type: 'sample' }),
    makeRow({ id: '  ', type: 'sample' }),
  ];

  assert.deepEqual(getAvailableParentOptions(rows), ['S1', 'S2']);
});

test('syncParentReferencesOnSampleRename updates QC parent links when a sample ID is renamed', () => {
  const prevSamples = [
    makeRow({ id: 'MB', type: 'blank_method' }),
    makeRow({ id: 'S1', type: 'sample' }),
  ];
  const nextSamples = [
    makeRow({ id: 'MB', type: 'blank_method' }),
    makeRow({ id: 'S-101', type: 'sample' }),
  ];
  const qcRows = [
    makeRow({ id: 'CCV1', type: 'ccv', parent: '' }),
    makeRow({ id: 'SP1', type: 'spike', parent: 'S1' }),
    makeRow({ id: 'D1', type: 'duplicate', parent: 'S1' }),
  ];

  const synced = syncParentReferencesOnSampleRename(qcRows, prevSamples, nextSamples);
  assert.equal(synced[0]?.parent, '');
  assert.equal(synced[1]?.parent, 'S-101');
  assert.equal(synced[2]?.parent, 'S-101');
});

test('renameAnalyteKeysInRows and removeAnalyteKeyInRows sync readings, expectedConc, and spikeAdded', () => {
  const rows: SampleRowState[] = [
    makeRow({
      id: 'CCV1',
      type: 'ccv',
      readings: { cd: 2000, Pb: 1000 },
      expectedConc: { cd: 50, Pb: 10 },
      spikeAdded: { cd: 5, Pb: 2 },
    }),
  ];

  const renamed = renameAnalyteKeysInRows(rows, 'cd', 'Cd');
  assert.deepEqual(renamed[0]?.readings, { Cd: 2000, Pb: 1000 });
  assert.deepEqual(renamed[0]?.expectedConc, { Cd: 50, Pb: 10 });
  assert.deepEqual(renamed[0]?.spikeAdded, { Cd: 5, Pb: 2 });

  const removed = removeAnalyteKeyInRows(renamed, 'Pb');
  assert.deepEqual(removed[0]?.readings, { Cd: 2000 });
  assert.deepEqual(removed[0]?.expectedConc, { Cd: 50 });
  assert.deepEqual(removed[0]?.spikeAdded, { Cd: 5 });
});

test('validateBatchSamples catches missing blank_method, duplicate IDs, bad parents, missing QC targets, and >250 rows', () => {
  const analytes = ['Al', 'Cd'];
  const sampleRows: SampleRowState[] = [
    makeRow({ id: 'S1', type: 'sample', readings: { Al: 100, Cd: 50 } }),
    makeRow({ id: 'CCV1', type: 'sample', readings: { Al: 100, Cd: 50 } }),
  ];
  const qcRows: SampleRowState[] = [
    makeRow({
      id: 'CCV1',
      type: 'ccv',
      weight: null,
      vol: null,
      df: null,
      expectedConc: { Al: 50, Cd: 0 },
      readings: { Al: 100, Cd: 50 },
    }),
    makeRow({
      id: 'SP1',
      type: 'spike',
      parent: 'MISSING',
      weight: null,
      spikeAdded: { Al: 10 },
      readings: { Al: 120, Cd: 60 },
    }),
  ];

  const issues = validateBatchSamples(sampleRows, qcRows, analytes);
  const messages = issues.map((i) => i.message).join(' | ');

  assert.match(messages, /blank_method/);
  assert.match(messages, /Duplicate/);
  assert.match(messages, /expectedConc/);
  assert.match(messages, /spikeAdded/);
  assert.match(messages, /Parent "MISSING"/);
  assert.match(messages, /SP1: Weight/);

  const overLimitSamples = Array.from({ length: 248 }, (_, idx) =>
    makeRow({
      id: `S${idx + 1}`,
      type: 'sample',
      readings: { Al: 10, Cd: 5 },
    }),
  );
  const overLimitQc = Array.from({ length: 3 }, (_, idx) =>
    makeRow({
      id: idx === 0 ? 'MB' : `CCV${idx}`,
      type: idx === 0 ? 'blank_method' : 'ccv',
      weight: null,
      vol: null,
      df: null,
      expectedConc: idx === 0 ? undefined : { Al: 50, Cd: 10 },
      readings: { Al: 10, Cd: 5 },
    }),
  );
  const limitIssues = validateBatchSamples(overLimitSamples, overLimitQc, analytes);
  assert.ok(limitIssues.some((i) => i.scope === 'batch' && i.message.includes('250')));
});

test('validateBatchSamples passes when blank_method and ccv have null prep params and toSampleRowInputs preserves null', () => {
  const analytes = ['Al', 'Cd'];
  const sampleRows: SampleRowState[] = [
    makeRow({ id: 'S1', labSampleId: ' 291843 ', type: 'sample', readings: { Al: 500, Cd: 100 } }),
  ];
  const qcRows: SampleRowState[] = [
    makeRow({
      id: 'MB',
      labSampleId: '   ',
      type: 'blank_method',
      weight: null,
      vol: null,
      df: null,
      readings: { Al: 10, Cd: 2, Old: 99 },
    }),
    makeRow({
      id: 'CCV1',
      type: 'ccv',
      parent: 'SHOULD_BE_CLEARED',
      weight: null,
      vol: null,
      df: null,
      expectedConc: { Al: 50, Cd: 10, Old: 1 },
      readings: { Al: 250, Cd: 50 },
    }),
    makeRow({
      id: 'SP1',
      type: 'spike',
      parent: 'S1',
      spikeAdded: { Al: 20, Cd: 5 },
      readings: { Al: 700, Cd: 150 },
    }),
    makeRow({
      id: 'D1',
      type: 'duplicate',
      parent: 'S1',
      readings: { Al: 505, Cd: 99 },
    }),
  ];

  assert.deepEqual(validateBatchSamples(sampleRows, qcRows, analytes), []);

  const dto = toSampleRowInputs(sampleRows, qcRows, analytes);
  assert.equal(dto.length, 5);
  assert.equal(dto[0]?.sampleId, 'S1');
  assert.equal(dto[0]?.labSampleId, '291843');
  assert.equal(dto[0]?.weight, 0.2);
  assert.deepEqual(dto[1], {
    sampleId: 'MB',
    labSampleId: null,
    sampleType: 'blank_method',
    parentSampleId: null,
    expectedConc: null,
    spikeAdded: null,
    weight: null,
    volume: null,
    df: null,
    readings: { Al: 10, Cd: 2 },
  });
  assert.deepEqual(dto[2], {
    sampleId: 'CCV1',
    labSampleId: null,
    sampleType: 'ccv',
    parentSampleId: null,
    expectedConc: { Al: 50, Cd: 10 },
    spikeAdded: null,
    weight: null,
    volume: null,
    df: null,
    readings: { Al: 250, Cd: 50 },
  });
  assert.equal(dto[3]?.parentSampleId, 'S1');
  assert.deepEqual(dto[3]?.spikeAdded, { Al: 20, Cd: 5 });
  assert.equal(dto[3]?.weight, 0.2);
  assert.equal(dto[4]?.parentSampleId, 'S1');
  assert.equal(dto[4]?.expectedConc, null);
  assert.equal(dto[4]?.spikeAdded, null);
  assert.equal(dto[4]?.volume, 50);
});

test('fillMissingCcvExpectedConc applies per-analyte defaults without overwriting manual entries', () => {
  const rows: SampleRowState[] = [
    makeRow({
      id: 'CCV1',
      type: 'ccv',
      weight: null,
      vol: null,
      df: null,
      expectedConc: { Al: 99 },
    }),
  ];

  const filled = fillMissingCcvExpectedConc(rows, ['Al', 'Cd', 'Hg'], {
    Al: 100,
    Cd: 50,
    Hg: 2,
  });

  assert.deepEqual(filled[0]?.expectedConc, { Al: 99, Cd: 50, Hg: 2 });
});
