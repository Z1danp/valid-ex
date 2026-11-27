import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignAnalyteToGroup,
  createInitialStandardGroups,
  getDefaultCcvTargetByAnalyte,
  getPointsForAnalyte,
  isAllStandardsReady,
  parseNominalFromName,
  parseOptionalNumberFromInput,
  renameAnalyteInStandardGroups,
  splitAnalyteToNewGroup,
  syncStandardGroupsWithAnalytes,
  toStandardRowInputs,
  type StandardGroup,
} from '../src/features/calibration/utils/standardGroups.ts';

test('parseNominalFromName parses blank and standard labels without defaulting unknown text to 0', () => {
  assert.equal(parseNominalFromName('Blank'), 0);
  assert.equal(parseNominalFromName(' blanko '), 0);
  assert.equal(parseNominalFromName('CalBlank'), 0);
  assert.equal(parseNominalFromName('Std 10'), 10);
  assert.equal(parseNominalFromName('CAL-0.5 ppm'), 0.5);
  assert.equal(parseNominalFromName('CRM-A'), undefined);
  assert.equal(parseNominalFromName('   '), undefined);
});

test('parseOptionalNumberFromInput distinguishes empty, zero, negative, and invalid strings', () => {
  assert.deepEqual(parseOptionalNumberFromInput('', false), {
    value: undefined,
    valid: true,
    empty: true,
  });
  assert.deepEqual(parseOptionalNumberFromInput('0', false), {
    value: 0,
    valid: true,
    empty: false,
  });
  assert.deepEqual(parseOptionalNumberFromInput('-5', false), {
    value: undefined,
    valid: false,
    empty: false,
  });
  assert.deepEqual(parseOptionalNumberFromInput('-5', true), {
    value: -5,
    valid: true,
    empty: false,
  });
  assert.deepEqual(parseOptionalNumberFromInput('12abc', false), {
    value: undefined,
    valid: false,
    empty: false,
  });
});

test('syncStandardGroupsWithAnalytes adds new analytes with empty signals and prunes removed ones', () => {
  const initial = createInitialStandardGroups(['Cd']);
  const withAdded = syncStandardGroupsWithAnalytes(initial, ['Cd', 'Hg']);

  assert.equal(withAdded.length, 1);
  assert.deepEqual(withAdded[0]?.analytes, ['Cd', 'Hg']);
  assert.equal(withAdded[0]?.rows[0]?.signals.Cd, 0);
  assert.equal(withAdded[0]?.rows[0]?.signals.Hg, undefined);

  const renamed = renameAnalyteInStandardGroups(withAdded, 'Cd', 'Pb');
  assert.deepEqual(renamed[0]?.analytes, ['Pb', 'Hg']);
  assert.equal(renamed[0]?.rows[1]?.signals.Pb, 10);

  const afterRemove = syncStandardGroupsWithAnalytes(renamed, ['Hg']);
  assert.deepEqual(afterRemove[0]?.analytes, ['Hg']);
  assert.equal(afterRemove[0]?.rows[1]?.signals.Pb, undefined);
});

test('splitAnalyteToNewGroup and assignAnalyteToGroup manage independent calibration series', () => {
  const groups: StandardGroup[] = [
    {
      id: 'group-1',
      analytes: ['Al', 'Cd', 'Hg'],
      rows: [
        { standardName: 'Blank', nominalConc: 0, signals: { Al: 10, Cd: 5 } },
        { standardName: 'Std 10', nominalConc: 10, signals: { Al: 110, Cd: 55 } },
        { standardName: 'Std 50', nominalConc: 50, signals: { Al: 510, Cd: 255 } },
      ],
    },
  ];

  // Splitting Hg when it has no entered signals starts a clean blank table for its own range.
  const split = splitAnalyteToNewGroup(groups, 'Hg');
  assert.equal(split.length, 2);
  assert.deepEqual(split[0]?.analytes, ['Al', 'Cd']);
  assert.deepEqual(split[1]?.analytes, ['Hg']);
  assert.equal(split[1]?.rows.length, 6);
  assert.equal(split[1]?.rows[0]?.nominalConc, undefined);

  // Populate Hg with its own concentration range [0, 1, 2, 5].
  const withHgSeries: StandardGroup[] = split.map((g, idx) =>
    idx === 1
      ? {
          ...g,
          rows: [
            { standardName: 'Blank', nominalConc: 0, signals: { Hg: 2 } },
            { standardName: 'Std 1', nominalConc: 1, signals: { Hg: 102 } },
            { standardName: 'Std 2', nominalConc: 2, signals: { Hg: 202 } },
            { standardName: 'Std 5', nominalConc: 5, signals: { Hg: 502 } },
          ],
        }
      : g,
  );

  assert.equal(isAllStandardsReady(withHgSeries, ['Al', 'Cd', 'Hg'], 3), true);
  assert.deepEqual(getPointsForAnalyte(withHgSeries, 'Hg'), [
    { standardName: 'Blank', nominalConc: 0, signal: 2 },
    { standardName: 'Std 1', nominalConc: 1, signal: 102 },
    { standardName: 'Std 2', nominalConc: 2, signal: 202 },
    { standardName: 'Std 5', nominalConc: 5, signal: 502 },
  ]);

  const ccvTargets = getDefaultCcvTargetByAnalyte(withHgSeries, ['Al', 'Cd', 'Hg']);
  assert.equal(ccvTargets.Al, 10);
  assert.equal(ccvTargets.Cd, 10);
  assert.equal(ccvTargets.Hg, 2);

  // Re-assigning Hg back to group-1 removes empty group-2.
  const merged = assignAnalyteToGroup(withHgSeries, 'Hg', 'group-1');
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0]?.analytes, ['Al', 'Cd', 'Hg']);
  assert.equal(merged[0]?.rows[0]?.signals.Hg, 2);
});

test('toStandardRowInputs emits explicit standardName and omits incomplete readings', () => {
  const groups: StandardGroup[] = [
    {
      id: 'group-1',
      analytes: ['Al', 'Cd'],
      rows: [
        { standardName: 'Blank', nominalConc: 0, signals: { Al: 5, Cd: 2 } },
        { standardName: '', nominalConc: 25, nominalConcManual: true, signals: { Al: 250 } },
        { standardName: 'Incomplete', nominalConc: undefined, signals: { Al: 999 } },
      ],
    },
  ];

  const dto = toStandardRowInputs(groups);
  assert.deepEqual(dto, [
    {
      standardName: 'Blank',
      readings: {
        Al: { nominalConc: 0, signal: 5 },
        Cd: { nominalConc: 0, signal: 2 },
      },
    },
    {
      standardName: 'Std 25',
      readings: {
        Al: { nominalConc: 25, signal: 250 },
      },
    },
  ]);
});
