import { AssertionResult } from '@jest/test-result';

export interface Result {
  description: string;
  errors: any[];
  success: boolean;
  skipped: boolean;
  time: number;
  suite: string[];
  log: string[];
  assertionResult: AssertionResult;
}

export type SnapshotResolver = (
  snapshotPath: string,
  suiteName: string,
  browserName: string,
) => string;
