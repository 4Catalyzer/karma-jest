/* eslint-disable no-underscore-dangle */
import * as Utils from 'jest-snapshot/build/utils';

import { SerializedSnapshotSuite, Snapshot, SnapshotSuite } from './types';

type UnchekedKeysBySuite = {
  suite: string;
  keys: Array<string>;
};

export interface SnapshotSummary {
  errored: number;
  unmatched: number;
  matched: number;
  updated: number;
  added: number;
  total: number;
  suitesRemoved: number;
  suitesRemovedList: string[];
  suitesAdded: number;

  unchecked: number;
  uncheckedKeys: string[];
  uncheckedKeysBySuite: UnchekedKeysBySuite[];
  result: SerializedSnapshotSuite[];
}

function normalizeNewlines(s: string) {
  return s.replace(/\r\n|\r/g, '\n');
}

export default class SnapshotState {
  private data: Map<string, SnapshotSuite>;

  private uncheckedKeys: Set<string>;

  private snapshots: Map<string, Snapshot>;

  added = 0;

  matched = 0;

  unmatched = 0;

  updated = 0;

  errored = 0;

  static serialize(suites: SnapshotSuite[]): SerializedSnapshotSuite[] {
    return suites.map(suite => ({
      ...suite,
      snapshots: Array.from(suite.snapshots.values()),
    }));
  }

  constructor(private update: 'all' | 'new' | false = 'new') {
    this.data = new Map(window.__snapshots__.suites);

    this.snapshots = new Map(
      Array.from(window.__snapshots__.suites).flatMap(d =>
        Array.from(d[1].snapshots),
      ),
    );

    this.uncheckedKeys = new Set(this.snapshots.keys());
  }

  private updateSnapshot(rootName: string, key: string, received: string) {
    const suite = this.data.get(rootName) || {
      name: rootName,
      snapshots: new Map(),
    };

    const snap = {
      name: key,
      data: received,
    };

    suite.snapshots.set(key, snap);
    this.data.set(rootName, suite);
    this.snapshots.set(key, snap);
    this.uncheckedKeys.delete(key);
  }

  markSnapshotsAsCheckedForTest(testName: string): void {
    this.uncheckedKeys.forEach(uncheckedKey => {
      // this isn't quite right but IDK
      if (uncheckedKey.startsWith(`${testName}:`)) {
        this.uncheckedKeys.delete(uncheckedKey);
      }
    });
  }

  summary(): SnapshotSummary {
    const prevSuites = window.__snapshots__.suites;

    const { errored, unmatched, matched, updated, added } = this;
    const nextData = [] as SerializedSnapshotSuite[];
    const uncheckedKeysBySuite = [];
    let suitesAdded = 0;
    const removedSuites = [] as string[];

    for (const [suiteName, suite] of this.data) {
      const snapshots = [] as Snapshot[];
      const fileUncheckedKeys = [];

      for (const entry of suite.snapshots) {
        if (this.uncheckedKeys.has(entry[0])) {
          fileUncheckedKeys.push(entry[0]);
          continue;
        }
        snapshots.push(entry[1]);
      }
      uncheckedKeysBySuite.push({
        suite: suite.name,
        keys: fileUncheckedKeys,
      });

      if (!prevSuites.has(suiteName)) suitesAdded++;
      else if (!snapshots.length) removedSuites.push(suiteName);

      nextData.push({ name: suiteName, snapshots });
    }

    return {
      errored,
      unmatched,
      matched,
      updated,
      added,
      total: this.snapshots.size,
      suitesAdded,
      suitesRemoved: removedSuites.length,
      suitesRemovedList: removedSuites,
      uncheckedKeysBySuite,
      unchecked: this.uncheckedKeys.size,
      uncheckedKeys: Array.from(this.uncheckedKeys),
      result: nextData,
    };
  }

  match(testPath: string[], hint: string, received: string) {
    // This adds leading and trailing newlines, which the deserializer removes.
    const serialized = Utils.serialize(received).trim();

    const key = `${testPath.join(' ')}: ${hint}`;

    const expected = this.snapshots.get(key);
    let pass = !expected || serialized === normalizeNewlines(expected.data);
    // debugger;
    if (this.update === 'all' && !pass) {
      this.updated++;
      pass = true;
    } else if (!expected) {
      if (this.update === 'new') {
        this.added++;
      } else {
        pass = false;
        this.unmatched++;
      }
    } else if (expected && pass) {
      this.matched++;
    } else if (!pass) {
      this.errored++;
    }

    this.updateSnapshot(testPath[0], key, serialized);
    // console.log('S:', key, {
    //   pass,
    //   actual: serialized,
    //   expected: expected?.data,
    //   this: this,
    // });

    return {
      key,
      pass,
      actual: serialized,
      expected: expected?.data,
    };
  }
}
