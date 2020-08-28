/* eslint-disable no-param-reassign */

import path from 'path';

import { constants } from 'karma';
// @ts-ignore
import useragent from 'ua-parser-js';

import Printer from './Printer';
import { SourceFile, cleanStack } from './Stack';
import { normalizeConfig } from './config';
import * as Serializer from './snapshot/Serializer';
import { SnapshotSummary } from './snapshot/State';
import { KarmaJestActions, LogType, Result } from './types';

export function browserShortName(fullname: string) {
  return useragent(fullname).browser.name;
}

function resolveSnapshotPath(
  snapshotPath: string,
  suiteName: string,
  browser: string,
) {
  return path.join(snapshotPath, `${suiteName}__${browser}.md`);
}

const CONTROL_C = '\u0003';
const CONTROL_D = '\u0004';
const ENTER = '\r';

function shouldLog(type: LogType, level?: string) {
  if (!level) return false;

  const priority = type.toUpperCase();

  const logPriority = constants.LOG_PRIORITIES.indexOf(
    level.toUpperCase() as any,
  );
  return constants.LOG_PRIORITIES.indexOf(priority as any) <= logPriority;
}

function Reporter(
  this: any,
  baseReporterDecorator: any,
  config: any,
  emitter: any,
  server: any,
) {
  // extend the base reporter
  baseReporterDecorator(this);

  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const reporter = this;

  let lastServedFiles = [] as SourceFile[];
  // snapshots by browser
  let allSnapshotState: Record<string, SnapshotSummary> = {};

  const { browserConsoleLogOptions } = config;

  const jestConfig = normalizeConfig(config, config.jest);
  const { snapshotPath, update } = jestConfig;

  const fullSnapshotPath = path.isAbsolute(snapshotPath)
    ? snapshotPath
    : path.join(config.basePath, snapshotPath);

  config.client = config.client || {};

  // pass the update state to the client
  config.client.snapshotUpdate = update;

  // Juuuust mutate this global config to disable the client
  // handling logs since we'll do that
  config.client.jestCaptureConsole = config.client.captureConsole ?? true;
  config.client.captureConsole = false;

  function updateSnapshots(up: typeof update = 'all') {
    Object.entries(allSnapshotState).forEach(([browser, state]) => {
      const resolver = (name: string) =>
        resolveSnapshotPath(fullSnapshotPath, path.basename(name), browser);

      Serializer.save(resolver, state, up);
    });
  }

  const { stdin } = process;

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  stdin.on('data', (key: string) => {
    if (key === 'q' || key === CONTROL_C || key === CONTROL_D) {
      stdin.setRawMode(false);

      reporter.write('\n');
      process.exit(0);
      return;
    }

    switch (key) {
      case 'u':
        // unlike Jest, we update snapshots without rerunning, partly b/c it's nicer
        // but mostly b/c it's easier to avoid an extra rerun.
        updateSnapshots();
        server.refreshFiles();
        // TODO maybe compare results from the triggered run to ensure the data
        // wasn't stale when saved?
        break;
      case 'a':
      case ENTER:
        server.refreshFiles();
        break;
      default:
        break;
    }
  });

  emitter.on('file_list_modified', (files: any) => {
    lastServedFiles = files.served;
  });

  const printer = new Printer({
    config: jestConfig,
    write: reporter.write.bind(reporter),
    numBrowsers: config.browsers?.length || 1,
    processError: (err) => {
      return cleanStack(err, config.basePath, lastServedFiles || []);
    },
    snapshotResolver: (name, browser) =>
      resolveSnapshotPath(fullSnapshotPath, path.basename(name), browser),
  });

  this.writeCommonMsg = (msg: string) => {
    printer.printMsg(msg);
  };

  this.onBrowserComplete = (browser: any, results: any) => {
    config.client.snapshotRefreshing = false;
    if (results?.snapshotState) {
      allSnapshotState[browserShortName(browser.fullName)] =
        results.snapshotState;
    }
  };

  // unhandled client errors
  this.onBrowserError = async (browser: any, error: any) => {
    if (error.includes('Disconnected')) return;

    printer.printHeader('fail', printer.browserDisplayName(browser));
    await printer.printError(error.trim());

    if (!config.singleRun) {
      reporter.write('\n');
      printer.printWatchPrompt();
    }
  };

  /**
   * This is the event funnel from karma.info() client calls
   * Karma doies some basic logging, but mostly we override the behavior
   * and use a more structured format to collect metadata about test progression
   */
  this.onBrowserInfo = (browser: any, info: any) => {
    if (info.log) {
      this.writeCommonMsg(info.log);
      return;
    }

    const action = info as KarmaJestActions;

    switch (action.jestType) {
      case 'log':
        if (shouldLog(action.payload.type, browserConsoleLogOptions?.level)) {
          printer.addLog(action.payload);
        }
        break;
      case 'run_start': {
        const { totalTests, testFiles, focused } = action.payload;

        printer.numEstimatedTotalTests += totalTests;

        testFiles.forEach((name) => {
          if (!focused.length || focused.includes(name)) {
            printer.addRootSuite(name, browser);
          }
        });
        break;
      }
      case 'test_start':
        printer.addTestStart(
          action.payload.name,
          action.payload.rootSuite,
          browser,
        );
        break;
      case 'rootSuite_finish':
        printer.rootSuiteFinished(action.payload.name, browser);
        break;
      default:
    }
  };

  this.onRunStart = (browser: any) => {
    browser.seen = false;

    printer.clearScreen();

    allSnapshotState = {};
    printer.runStart();

    // required by the base class, this is the worst version of inheritance
    this._browsers = [];
  };

  this.onSpecComplete = (_: any, result: Result) => {
    printer.addTestResult(result);
  };

  this.onRunComplete = async (_browsers: any, result: any) => {
    printer.runFinished();

    printer.printStatus(false);

    if (result.failed) {
      await printer.printFailures();
    }

    if (update === 'new' && config.browsers?.length <= 1) {
      updateSnapshots(update);
    }

    await printer.printSummary(allSnapshotState);

    if (!config.singleRun) {
      reporter.write('\n');
      printer.printWatchPrompt();
    }
  };
}

Reporter.$inject = ['baseReporterDecorator', 'config', 'emitter', 'server'];

export default Reporter;
