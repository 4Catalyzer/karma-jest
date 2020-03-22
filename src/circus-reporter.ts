/* eslint-disable no-param-reassign */

import path from 'path';

// import { constants } from 'karma';

import Printer from './Printer';
import { SourceFile } from './Stack';
import * as Serializer from './snapshot/Serializer';
import { SnapshotSummary } from './snapshot/State';
import { Result } from './types';

function resolveSnapshotPath(
  snapshotPath: string,
  suiteName: string,
  _browser: string,
) {
  return path.join(snapshotPath, `${suiteName}.md`);
}

const CLEAR =
  process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H';

const CONTROL_C = '\u0003';
const CONTROL_D = '\u0004';

export interface Config {
  snapshotPath?: string;
  update?: 'new' | 'all' | false;
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
  let allSnapshotState: Record<string, SnapshotSummary> = {};

  const jestConfig: Config = config.jest || {};
  const {
    snapshotPath = `__snapshots__`,
    update = config.singleRun ? false : 'new',
  } = jestConfig;

  const fullSnapshotPath = path.isAbsolute(snapshotPath)
    ? snapshotPath
    : path.join(config.basePath, snapshotPath);

  config.client = config.client || {};

  // pass the update state to the client
  config.client.snapshotUpdate = update;

  function updateSnapshots() {
    Object.entries(allSnapshotState).forEach(([browser, state]) => {
      const resolver = (name: string) =>
        resolveSnapshotPath(fullSnapshotPath, name, browser);

      Serializer.save(resolver, state, 'all');
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
        server.refreshFiles();
        break;
      default:
        break;
    }
  });

  emitter.on('file_list_modified', (files: any) => {
    lastServedFiles = files.served;
  });

  // this seems to be the only way to get the result of karma.complete()
  emitter.on('browser_complete', (browser: any, results: any) => {
    config.client.snapshotRefreshing = false;
    if (results.snapshotState) {
      allSnapshotState[browser.name] = results.snapshotState;
    }
  });

  const printer = new Printer({
    write: reporter.write.bind(reporter),
    numBrowsers: config.browsers?.length || 1,
    snapshotResolver: (name, browser) =>
      resolveSnapshotPath(fullSnapshotPath, name, browser),
  });

  this.onRunStart = () => {
    reporter.write(CLEAR);
    allSnapshotState = {};
    printer.runStart();

    // required by the base class, this is the worst version of inheritance
    this._browsers = [];
  };

  this.onSpecComplete = (_: any, result: Result) => {
    printer.addTestResult(result);
  };

  // TODO: buffer and display console from browsers
  // this.onBrowserLog = (browser, log, type) => {
  //   console.log('HERERERERERER', log, type);
  // };

  this.onRunComplete = async (_browsers: any, result: any) => {
    if (result.failed) {
      await printer.printFailures(config.basePath, lastServedFiles);
    }

    printer.printSummary(allSnapshotState);

    if (!config.singleRun) {
      reporter.write('\n');
      printer.printWatchPrompt();
    }
  };
}

Reporter.$inject = ['baseReporterDecorator', 'config', 'emitter', 'server'];

export default Reporter;
