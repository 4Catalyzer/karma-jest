/* eslint-disable max-classes-per-file */
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { wrapAnsiString } from '@jest/reporters/build/utils';
import colors from 'ansi-colors';

const RUNNINGTEXT = ' RUNS ';
const RUNNING = `${colors.reset.inverse.yellow.bold(RUNNINGTEXT)} `;

/**
 * This class is a perf optimization for sorting the list of currently
 * running tests. It tries to keep tests in the same positions without
 * shifting the whole list.
 */
class CurrentTestList {
  private array: Array<{
    suiteName: string;
    browserName: string;
  } | null> = [];

  add(suiteName: string, browserName: string) {
    const index = this.array.indexOf(null);
    const record = { browserName, suiteName };
    if (index !== -1) {
      this.array[index] = record;
    } else {
      this.array.push(record);
    }
  }

  delete(suiteName: string) {
    const record = this.array.find(
      (r) => r !== null && r.suiteName === suiteName,
    );
    this.array[this.array.indexOf(record || null)] = null;
  }

  get() {
    return this.array;
  }
}

type Cache = {
  content: string;
  clear: string;
};

/**
 * A class that generates the CLI status of currently running tests
 * and also provides an ANSI escape sequence to remove status lines
 * from the terminal.
 */
export default class Status {
  private cache: Cache | null = null;

  private callback?: () => void;

  private currentTests: CurrentTestList = new CurrentTestList();

  private done = false;

  private emitScheduled = false;

  private interval?: NodeJS.Timeout;

  constructor(callback: () => void) {
    this.callback = callback;
  }

  runStarted(): void {
    this.done = false;
    this.emit();
  }

  runFinished(): void {
    this.done = true;
    if (this.interval) clearInterval(this.interval);
    this.emit();
  }

  suiteStarted(suiteName: string, browserName?: string): void {
    this.currentTests.add(suiteName, browserName || '');
    this.emit();
  }

  suiteFinished(suiteName: string): void {
    this.currentTests.delete(suiteName);
    this.emit();
  }

  get(): Cache {
    if (this.cache) return this.cache;
    if (this.done) return { clear: '', content: '' };

    const width: number = process.stdout.columns!;
    let content = '\n';
    this.currentTests.get().forEach((record) => {
      if (record) {
        const { browserName, suiteName } = record;

        const projectDisplayName = browserName ? `${browserName} ` : '';
        const prefix = RUNNING + projectDisplayName;

        content += `${wrapAnsiString(
          prefix + colors.bold(suiteName),
          width,
        )}\n`;
      }
    });

    let height = 0;
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '\n') {
        height++;
      }
    }

    const clear = '\r\x1B[K\r\x1B[1A'.repeat(height);
    this.cache = { clear, content };
    return this.cache;
  }

  private emit() {
    this.cache = null;
    if (this.callback) this.callback();
  }

  // private debouncedEmit() {
  //   if (!this.emitScheduled) {
  //     // Perf optimization to avoid two separate renders When
  //     // one test finishes and another test starts executing.
  //     this.emitScheduled = true;
  //     setTimeout(() => {
  //       this.emit();
  //       this.emitScheduled = false;
  //     }, 100);
  //   }
  // }
}
