import { AssertionResult } from '@jest/test-result';

export interface Result {
  description: string;
  errors: any[];
  failed: boolean;
  success: boolean;
  notRun: boolean;
  time: number;
  suite: string[];
  log: string[];
  assertionResult: AssertionResult;

  // an error thrown outside of the test runner
  error?: Error;
}

export type SnapshotResolver = (
  snapshotPath: string,
  suiteName: string,
  browserName: string,
) => string;
