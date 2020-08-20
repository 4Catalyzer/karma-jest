import { AssertionResult } from '@jest/test-result';

export type LogType = 'debug' | 'error' | 'info' | 'log' | 'warn';

export type LogAction = {
  jestType: 'log';
  payload: {
    message: string;
    type: LogType;
    origin: string;
  };
};

export type RunStartAction = {
  jestType: 'run_start';
  payload: {
    totalTests: number;
    testFiles: string[];
    rootSuites: Array<{
      name: string;
      only: boolean;
    }>;
  };
};

export type RootSuiteStartAction = {
  jestType: 'rootSuite_start';
  payload: { name: string };
};

export type TestStartAction = {
  jestType: 'test_start';
  payload: { name: string; rootSuite: string };
};

export type RootSuiteFinishAction = {
  jestType: 'rootSuite_finish';
  payload: { name: string };
};

export type KarmaJestActions =
  | LogAction
  | RunStartAction
  | RootSuiteStartAction
  | TestStartAction
  | RootSuiteFinishAction;

export interface Result {
  description: string;
  errors: any[];
  failed: boolean;
  success: boolean;
  notRun: boolean;
  /**
   * This is for karma debug.js and other karma tooling which has a less nuanced version of todo/skip
   * use `notRun` instead.
   * */
  skipped: boolean;
  time: number;
  suite: string[];
  log: string[];
  testFilePath: string;
  assertionResult: AssertionResult;

  // an error thrown outside of the test runner
  error?: Error;
}

export type SnapshotResolver = (
  snapshotPath: string,
  suiteName: string,
  browserName: string,
) => string;
