/* eslint-disable no-param-reassign */
import getSnapshotSummary from '@jest/reporters/build/get_snapshot_summary';
import { getSummary } from '@jest/reporters/build/utils';
import {
  AssertionResult,
  SnapshotSummary as JestSnapshotSummary,
  Suite,
} from '@jest/test-result';
import { makeEmptyAggregatedTestResult } from '@jest/test-result/build/helpers';
import colors from 'ansi-colors';
import { formatResultsErrors } from 'jest-message-util';

import { SourceFile, cleanStack } from './Stack';
import { SnapshotSummary } from './snapshot/State';
import { Result } from './types';

const isWindows = process.platform === 'win32';
const ARROW = ' \u203A ';

function getIcon(status: string) {
  if (status === 'failed') {
    return colors.red(isWindows ? '\u00D7' : '\u2715');
  }
  if (status === 'pending') {
    return colors.yellow('\u25CB');
  }
  if (status === 'todo') {
    return colors.magenta('\u270E');
  }
  return colors.green(isWindows ? '\u221A' : '\u2713');
}

const globalConfig = {
  rootDir: process.cwd(),
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
};

type SnapshotResolver = (suiteName: string, browserName: string) => string;

export type Options = {
  write: (log: string) => void;
  verbose?: boolean;
  numBrowsers?: number;
  snapshotResolver: SnapshotResolver;
};

export default class Printer {
  private testCount = new Map<string, number>();

  private printed = new WeakSet<any>();

  private root: Suite = { suites: [], tests: [], title: '' };

  private numFailedTests = 0;

  private numSkippedTests = 0;

  private suites = new Set<string>();

  private failedSuites = new Set<string>();

  private skippedSuites = new Set<string>();

  private startTime: number = Date.now();

  private write: (log: string) => void;

  private snapshotResolver: SnapshotResolver;

  private verbose: boolean;

  private numBrowsers: number;

  results = new Set<Result>();

  constructor({ write, verbose, numBrowsers, snapshotResolver }: Options) {
    this.write = write;
    this.verbose = verbose || false;
    this.numBrowsers = numBrowsers || 1;
    this.snapshotResolver = snapshotResolver;
  }

  runStart() {
    this.root = { suites: [], tests: [], title: '' };
    this.testCount.clear();
    this.results.clear();

    this.numFailedTests = 0;
    this.numSkippedTests = 0;
    this.suites.clear();
    this.failedSuites.clear();
    this.skippedSuites.clear();
    this.startTime = Date.now();
  }

  private isSuiteComplete(items: Suite): boolean {
    const isCompleted = items.tests.every(
      t => this.testCount.get(t.title) === this.numBrowsers,
    );

    return isCompleted && items.suites.every(s => this.isSuiteComplete(s));
  }

  addTestResult(testResult: Result) {
    const { assertionResult } = testResult;
    let targetSuite = this.root;

    // Find the target suite for this test,
    // creating nested suites as necessary.
    for (const title of assertionResult.ancestorTitles) {
      this.suites.add(title);

      if (testResult.skipped) {
        this.skippedSuites.add(title);
        this.numSkippedTests++;
      } else if (!testResult.success) {
        this.failedSuites.add(title);
        this.numFailedTests++;
      }

      let matchingSuite = targetSuite.suites.find(s => s.title === title);
      if (!matchingSuite) {
        matchingSuite = { suites: [], tests: [], title };
        targetSuite.suites.push(matchingSuite);
      }
      targetSuite = matchingSuite;
    }
    targetSuite.tests.push(assertionResult);

    this.results.add(testResult);

    const count = (this.testCount.get(testResult.description) ?? 0) + 1;

    this.testCount.set(testResult.description, count);

    if (count === this.numBrowsers) {
      this.printSuite(this.root);
    }
  }

  private printTest(test: AssertionResult, indentLevel: number) {
    if (this.printed.has(test)) return;
    const status = getIcon(test.status);
    const time = test.duration ? ` (${test.duration.toFixed(0)}ms)` : '';
    this.printLine(`${status} ${colors.dim(test.title + time)}`, indentLevel);
    this.printed.add(test);
  }

  private printTests(tests: Array<AssertionResult>, indentLevel: number) {
    if (this.verbose) {
      tests.forEach(test => this.printTest(test, indentLevel));
    } else {
      const summedTests = tests.reduce<{
        pending: Array<AssertionResult>;
        todo: Array<AssertionResult>;
      }>(
        (result, test) => {
          if (this.printed.has(test)) return result;

          if (test.status === 'pending') {
            result.pending.push(test);
          } else if (test.status === 'todo') {
            result.todo.push(test);
          } else {
            this.printTest(test, indentLevel);
          }

          return result;
        },
        { pending: [], todo: [] },
      );

      if (summedTests.pending.length > 0) {
        summedTests.pending.forEach(this.printTodoOrPendingTest(indentLevel));
      }

      if (summedTests.todo.length > 0) {
        summedTests.todo.forEach(this.printTodoOrPendingTest(indentLevel));
      }
    }
  }

  private printTodoOrPendingTest(indentLevel: number) {
    return (test: AssertionResult): void => {
      const printedTestStatus =
        test.status === 'pending' ? 'skipped' : test.status;

      const text = colors.dim(`${printedTestStatus} ${test.title}`);
      this.printLine(`${getIcon(test.status)} ${text}`, indentLevel);
      this.printed.add(test);
    };
  }

  printLine(str?: string, indentLevel?: number) {
    const indentation = '  '.repeat(indentLevel || 0);
    this.write(`${indentation + (str || '')}\n`);
  }

  private printSuite(suite: Suite, indentLevel = 0) {
    if (!this.isSuiteComplete(suite)) return;

    if (suite.title && !this.printed.has(suite)) {
      this.printLine(suite.title, indentLevel);
      this.printed.add(suite);
    }

    this.printTests(suite.tests, indentLevel + 1);

    suite.suites.forEach(s => this.printSuite(s, indentLevel + 1));
  }

  async printFailures(basePath: string, sourceFiles?: SourceFile[]) {
    const errs = await Promise.all(
      Array.from(this.results, async err => {
        err.assertionResult.failureMessages = await Promise.all(
          err.assertionResult.failureMessages.map(msg =>
            cleanStack(msg, basePath, sourceFiles || []),
          ),
        );
        return err.assertionResult;
      }),
    );

    this.write(`\n${colors.bold('Summary of all failing tests')}\n`);

    this.write(
      formatResultsErrors(errs, globalConfig, { noStackTrace: false }) || '',
    );
  }

  printSummary(snapshotState: Record<string, SnapshotSummary>) {
    const width = process.stdout.columns!;
    const emptyResult = makeEmptyAggregatedTestResult();

    if (Object.keys(snapshotState).length > 1) {
      throw new Error("can't handle multiple browser snapshots at the moment");
    }

    const { snapshot } = emptyResult;
    for (const [browser, browserSnapState] of Object.entries(snapshotState)) {
      const resolver = (name: string) => this.snapshotResolver(name, browser);

      if (!snapshot.didUpdate) snapshot.didUpdate = !!browserSnapState.updated;

      snapshot.total += browserSnapState.total;
      snapshot.added += browserSnapState.added;
      snapshot.matched += browserSnapState.matched;
      snapshot.unchecked += browserSnapState.unchecked;

      snapshot.filesAdded += browserSnapState.suitesAdded;
      snapshot.filesRemoved += browserSnapState.suitesRemoved;
      snapshot.filesRemovedList.push(
        ...browserSnapState.suitesRemovedList.map(resolver),
      );

      snapshot.uncheckedKeysByFile.push(
        ...browserSnapState.uncheckedKeysBySuite.map(f => ({
          ...f,
          filePath: resolver(f.suite),
        })),
      );
    }

    const summary = getSummary(
      {
        ...emptyResult,
        numFailedTests: this.numFailedTests,
        numTodoTests: this.numSkippedTests,
        numTotalTests: this.results.size,
        numPassedTests:
          this.results.size - (this.numFailedTests + this.numSkippedTests),
        numFailedTestSuites: this.failedSuites.size,
        numPassedTestSuites:
          this.suites.size -
          (this.failedSuites.size + this.skippedSuites.size),
        numTotalTestSuites: this.suites.size,
        startTime: this.startTime,
        snapshot,
      },
      { width },
    );

    try {
      this.printSnapshotSummary(snapshot);
    } catch (err) {
      console.error(err);
    }

    this.write(`\n${summary}\n`);
  }

  printSnapshotSummary(snapshots: JestSnapshotSummary) {
    if (
      snapshots.added ||
      snapshots.unmatched ||
      snapshots.updated ||
      snapshots.filesRemoved
    ) {
      const snapshotSummary = getSnapshotSummary(
        snapshots,
        globalConfig as any,
        'press u',
      );
      this.write('\n');
      snapshotSummary.forEach(l => this.write(`${l}\n`));
    }
  }

  printWatchPrompt() {
    // readline.clearLine(process.stdout, 0);
    // readline.cursorTo(process.stdout, 0);

    this.write(`
${colors.bold('Watch Usage')}
${colors.dim(` ${ARROW} Press`)} q ${colors.dim('to quit.')}
${colors.dim(` ${ARROW} Press`)} a ${colors.dim('to run all tests.')}
${colors.dim(` ${ARROW} Press`)} u ${colors.dim('to update snapshots.')}

`);
  }
}
