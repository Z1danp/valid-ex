import { pgEnum } from "drizzle-orm/pg-core";

export const authProviderEnum = pgEnum('auth_provider', ['local', 'google']);

export const instrumentTypeEnum = pgEnum('instrument_type', ['ICP-MS', 'ICP-OES', 'AAS', 'HPLC', 'GC-MS']);

export const inputModeEnum = pgEnum('input_mode', ['raw_signal', 'in_vial_concentration']);

export const sampleTypeEnum = pgEnum('sample_type', ['sample', 'blank_method', 'ccv', 'spike', 'duplicate']);

export const qcStatusEnum = pgEnum('qc_status', ['PASSED', 'INVALID_QC']);

export const solutionConcUnitEnum = pgEnum('solution_conc_unit', ['ppm', 'ppb', 'ppt'])