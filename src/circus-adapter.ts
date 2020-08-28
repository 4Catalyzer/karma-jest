/* eslint-disable no-param-reassign */

import FakeTimers from '@jest/fake-timers/build/modernFakeTimers';
import { AssertionResult } from '@jest/test-result';
import { Circus } from '@jest/types';
import { DescribeBlock, TestEntry } from '@jest/types/build/Circus';
import colors from 'ansi-colors';
import expect from 'expect';
import * as TestGlobals from 'jest-circus';
import run from 'jest-circus/build/run';
import RunnerState from 'jest-circus/build/state';
import Mock from 'jest-mock';
import countBy from 'lodash/countBy';

import Console from './Console';
import getTestPath from './getTestPath';
import SnapshotState from './snapshot/State';
import snapshotMatchers, { SnapshotMatcherState } from './snapshot/matchers';
import { KarmaJestActions, Result } from './types';

const console = Console.proxy();

type MatcherState = SnapshotMatcherState & {
  unhandledErrors: Error[];
};

// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
const { __karma__: karma } = window;

const testTimeoutSymbol = Symbol.for('TEST_TIMEOUT_SYMBOL');

// eslint-disable-next-line no-underscore-dangle
window.__snapshots__ = window.__snapshots__ || { suites: new Map() };
// eslint-disable-next-line no-underscore-dangle
window.__runnerState__ = RunnerState;

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

function getError(
  errors?: Circus.Exception | [Circus.Exception | undefined, Circus.Exception],
): Error {
  let error;
  let asyncError;

  if (Array.isArray(errors)) {
    error = errors[0];
    asyncError = errors[1];
  } else {
    error = errors;
    asyncError = new Error();
  }

  if (error && (error.stack || error.message)) {
    return error;
  }

  // asyncError.message = `thrown: ${prettyFormat(error, {maxDepth: 3})}`;
  asyncError.message = `thrown: ${error}`;

  return asyncError;
}

function convertTestToResult(test: Circus.TestEntry): Result {
  const testPath = getTestPath(test);
  const suite = testPath.slice(0, -1);
  const failureDetails = test.errors.map(getError);
  const failureMessages = failureDetails.map(
    (error) => error.stack || error.message,
  );
  const fullName = testPath.slice(1).join(' ').trim();

  let status: AssertionResult['status'];
  if (test.status === 'skip') {
    status = 'skipped';
  } else if (test.status === 'todo') {
    status = 'todo';
  } else if (test.errors.length) {
    status = 'failed';
  } else {
    status = 'passed';
  }
  const notRun = test.status === 'skip' || test.status === 'todo';
  const failed = !!test.errors.length;

  return {
    suite,
    description: test.name,
    time: test.duration || 0,
    failed,
    notRun,

    skipped: notRun, // skipped is solely for the karma debug.js which looks at this property

    success: !failed,
    log: failureMessages.map((msg) => colors.unstyle(msg)),
    errors: failureMessages,
    testFilePath: testPath[0],
    assertionResult: {
      status,
      fullName,
      failureDetails,
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

function nonRootParent(block: Circus.TestEntry | Circus.DescribeBlock) {
  while (block) {
    if (block.parent?.name === RunnerState.ROOT_DESCRIBE_BLOCK_NAME)
      return block;
    block = block.parent!;
  }
  return block;
}

function collect(root: Circus.DescribeBlock | Circus.TestEntry) {
  let total = 0;
  const focused = [] as string[];

  const stack = [root];
  let node;
  // eslint-disable-next-line no-cond-assign
  while ((node = stack.shift())) {
    if ('children' in node) stack.push(...node.children);

    if (node.type === 'test') total++;
    if (node.mode === 'only') {
      // @ts-expect-error testFile is not defined
      focused.push(nonRootParent(node)?.testFile);
    }
  }

  return { total, focused };
}

// function collectDescribes(block: Circus.DescribeBlock) {
//   const total;
// }
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

function emit<Action extends KarmaJestActions>(action: Action) {
  karma.info(action);
}

function isRootDescribe(block: DescribeBlock | TestEntry) {
  const root = RunnerState.getState().rootDescribeBlock;
  return block.parent === root;
}

let refCount: Record<string, number>;

type RunnerState = Circus.State & {
  testFile: string;
};

RunnerState.addEventHandler((event: Circus.Event) => {
  switch (event.name) {
    case 'start_describe_definition': {
      const {
        currentDescribeBlock,
        rootDescribeBlock,
        testFile,
      } = RunnerState.getState() as RunnerState;

      if (currentDescribeBlock.parent === rootDescribeBlock)
        // @ts-ignore
        currentDescribeBlock.testFile = testFile;
      break;
    }
    case 'add_test': {
      const {
        currentDescribeBlock,
        rootDescribeBlock,
        testFile,
      } = RunnerState.getState() as RunnerState;

      if (
        currentDescribeBlock === rootDescribeBlock &&
        currentDescribeBlock.tests
      )
        currentDescribeBlock.tests?.forEach((t: any) => {
          t.testFile = testFile;
        });
      break;
    }
    case 'run_start': {
      const root = RunnerState.getState().rootDescribeBlock;

      const { total, focused } = collect(root);

      // this is not really important but Karma warns if you don't report the total
      karma.info({ total });

      refCount = countBy(
        root.children,
        (r: any) => r.type === 'describeBlock' && r.testFile,
      );

      emit({
        jestType: 'run_start',
        payload: {
          focused,
          testFiles: Object.keys(refCount),
          totalTests: total,
        },
      });

      break;
    }
    // case 'run_describe_start':
    //   // console.log(event.describeBlock.mode);
    //   if (isRootDescribe(event.describeBlock))
    //     emit({
    //       jestType: 'rootSuite_start',
    //       payload: { name: event.describeBlock.name },
    //     });
    //   break;
    case 'run_describe_finish': {
      const { testFile } = event.describeBlock as any;
      if (isRootDescribe(event.describeBlock) && --refCount[testFile] <= 0)
        emit({
          jestType: 'rootSuite_finish',
          payload: { name: testFile },
        });
      break;
    }
    case 'test_start': {
      // console.log(event.test.mode);
      const currentTestPath = getTestPath(event.test);
      expect.setState({
        index: -1,
        currentTestPath,
      });
      emit({
        jestType: 'test_start',
        payload: {
          name: currentTestPath[currentTestPath.length - 1],
          rootSuite: currentTestPath[0],
        },
      });
      break;
    }
    case 'test_skip': // it.skip() or others when it.only
    case 'test_todo': // it.todo()
    case 'test_done': {
      const { snapshot } = expect.getState() as MatcherState;
      addExpectedAssertionErrors(event.test);
      addSuppressedErrors(event.test);

      const result = convertTestToResult(event.test);
      if (result.failed || result.notRun) {
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

  // if ('asyncError' in event) {
  //   const state = expect.getState() as MatcherState;
  //   state.unhandledErrors = state.unhandledErrors || [];
  //   state.unhandledErrors.push(event.asyncError);
  // }
});

window.onerror = (msgOrError, source, lineno, colno, error) => {
  // Karma does weird things to the error instead of just using the error arg
  if (error) {
    // @ts-ignore
    karma.error('', undefined, undefined, undefined, error);
  } else {
    // @ts-ignore
    karma.error(msgOrError, source, lineno, colno, error);
  }
};

karma.start = async () => {
  if (karma.config.snapshotRefreshing) {
    karma.complete({
      skipped: true,
      snapshotState: null,
    });
    return;
  }

  let result = {};
  try {
    const json = await fetch(`base/snapshots`).then((r) => r.json());

    const snapshot = new SnapshotState(karma.config?.snapshotUpdate, json);

    expect.setState({ snapshot });

    await run();

    result = {
      snapshotState: snapshot.summary(),
    };
  } catch (err) {
    console.error(err);
    throw err;
    // result = err;
  } finally {
    karma.complete(result);
  }
};
