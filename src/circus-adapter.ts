/* eslint-disable no-underscore-dangle, no-param-reassign */

import FakeTimers from '@jest/fake-timers/build/modernFakeTimers';
import { AssertionResult } from '@jest/test-result';
import { Circus } from '@jest/types';
import colors from 'ansi-colors';
import expect from 'expect';
import * as TestGlobals from 'jest-circus';
import run from 'jest-circus/build/run';
import RunnerState from 'jest-circus/build/state';
import Mock from 'jest-mock';

import getTestPath from './getTestPath';
import SnapshotState from './snapshot/State';
import snapshotMatchers, { SnapshotMatcherState } from './snapshot/matchers';
import { Result } from './types';

const { __karma__: karma } = window;

const testTimeoutSymbol = Symbol.for('TEST_TIMEOUT_SYMBOL');

window.__snapshots__ = window.__snapshots__ || { suites: new Map() };

const fakeTimers = new FakeTimers({
  global: window,
  config: {
    rootDir: '/',
    testMatch: [
      '**/__tests__/**/*.[jt]s?(x)',
      '**/?(*.)+(spec|test).[jt]s?(x)',
    ],
  },
} as any);

export type KarmaJest = {
  fn: typeof Mock.fn;
  spyOn: typeof Mock.spyOn;
  setTimeout: (msToRun: number) => KarmaJest;
  advanceTimersByTime: (msToRun: number) => void;
  advanceTimersToNextTimer: (steps?: number) => void;
  clearAllTimers: () => void;

  getTimerCount: () => void;
  // not supported in lolex
  // runAllImmediates: () => fakeTimers.runAllImmediates(),
  runAllTicks: () => void;
  runAllTimers: () => void;
  runOnlyPendingTimers: () => void;
  runTimersToTime: (msToRun: number) => void;

  useFakeTimers: () => KarmaJest;
  useRealTimers: () => KarmaJest;
};

const karmaJest: KarmaJest = {
  fn: Mock.fn.bind(Mock),
  spyOn: Mock.spyOn.bind(Mock),

  setTimeout: (timeoutMs: number) => {
    // @ts-ignore
    global[testTimeoutSymbol] = timeoutMs;

    return karmaJest;
  },

  advanceTimersByTime: (msToRun: number) =>
    fakeTimers.advanceTimersByTime(msToRun),
  advanceTimersToNextTimer: (steps?: number) =>
    fakeTimers.advanceTimersToNextTimer(steps),
  clearAllTimers: () => fakeTimers.clearAllTimers(),

  getTimerCount: () => fakeTimers.getTimerCount(),
  // not supported in lolex
  // runAllImmediates: () => fakeTimers.runAllImmediates(),
  runAllTicks: () => fakeTimers.runAllTicks(),
  runAllTimers: () => fakeTimers.runAllTimers(),
  runOnlyPendingTimers: () => fakeTimers.runOnlyPendingTimers(),
  runTimersToTime: (msToRun: number) =>
    fakeTimers.advanceTimersByTime(msToRun),

  useFakeTimers: () => {
    fakeTimers.useFakeTimers();
    return karmaJest;
  },
  useRealTimers: () => {
    fakeTimers.useRealTimers();
    return karmaJest;
  },
};

// @ts-ignore
window.expect = expect;

// @ts-ignore
window.karmaJest = karmaJest;

Object.assign(window, TestGlobals);

snapshotMatchers(expect);

function formatError(
  errors?: Circus.Exception | [Circus.Exception | undefined, Circus.Exception],
): string {
  let error;
  let asyncError;

  if (Array.isArray(errors)) {
    error = errors[0];
    asyncError = errors[1];
  } else {
    error = errors;
    asyncError = new Error();
  }

  if (error) {
    if (error.stack) {
      return error.stack;
    }
    if (error.message) {
      return error.message;
    }
  }

  // asyncError.message = `thrown: ${prettyFormat(error, { maxDepth: 3 })}`;

  return asyncError.stack;
}

function convertTestToResult(test: Circus.TestEntry): Result {
  const testPath = getTestPath(test);
  const suite = testPath.slice(0, -1);
  const failureMessages = test.errors.map(formatError) as string[];
  const fullName = testPath.join(' ').trim();

  let status: AssertionResult['status'];
  if (test.status === 'skip') {
    status = 'pending';
  } else if (test.status === 'todo') {
    status = 'todo';
  } else if (test.errors.length) {
    status = 'failed';
  } else {
    status = 'passed';
  }
  // console.log(test.name, test.status);
  return {
    suite,
    description: test.name,
    time: test.duration || 0,
    success: test.errors.length === 0,
    skipped: test.status === 'skip',
    log: failureMessages.map((msg) => colors.unstyle(msg)),
    errors: failureMessages,
    assertionResult: {
      status,
      fullName,
      failureMessages,
      duration: test.duration,
      ancestorTitles: suite,
      invocations: test.invocations,
      location: null,
      numPassingAsserts: 0, // doesn't seem used anywhere
      title: test.name,
    },
  };
}

function getTotal(block: Circus.DescribeBlock) {
  let total = 0;
  for (const child of block.children) {
    total += child.type === 'test' ? 1 : getTotal(child);
  }
  return total;
}
// Get suppressed errors from `jest-matchers` that weren't throw during
// test execution and add them to the test result, potentially failing
// a passing test.
const addSuppressedErrors = (test: Circus.TestEntry) => {
  const { suppressedErrors } = expect.getState();
  expect.setState({ suppressedErrors: [] });
  if (suppressedErrors.length) {
    test.errors = test.errors.concat(suppressedErrors);
  }
};

const addExpectedAssertionErrors = (test: Circus.TestEntry) => {
  const failures = expect.extractExpectedAssertionsErrors();
  test.errors = test.errors.concat(failures);
};

RunnerState.addEventHandler((event: Circus.Event) => {
  switch (event.name) {
    case 'run_start':
      expect.setState({
        snapshot: new SnapshotState(karma.config?.snapshotUpdate),
      });
      // this is not really important but Karma warns if you don't report the total
      karma.info({
        total: getTotal(RunnerState.getState().rootDescribeBlock),
      });
      break;
    case 'test_start': {
      expect.setState({
        index: -1,
        currentTestPath: getTestPath(event.test),
      });
      break;
    }
    case 'test_skip':
    case 'test_done': {
      const { snapshot } = expect.getState() as SnapshotMatcherState;
      addExpectedAssertionErrors(event.test);
      addSuppressedErrors(event.test);

      const result = convertTestToResult(event.test);
      if (!result.success || result.skipped) {
        snapshot.markSnapshotsAsCheckedForTest(
          result.assertionResult.fullName,
        );
      }

      karma.result(result);
      break;
    }
    default:
      break;
  }
});

karma.start = async () => {
  if (karma.config.snapshotRefreshing) {
    karma.complete({
      skipped: true,
      snapshotState: null,
    });
    return;
  }

  await run();

  const { snapshot } = expect.getState() as SnapshotMatcherState;

  karma.complete({
    snapshotState: snapshot.summary(),
  });
};
