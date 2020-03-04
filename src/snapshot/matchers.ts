import colors from 'ansi-colors';
import { MatcherState } from 'expect';
import { Expect } from 'expect/build/types';
import { addSerializer } from 'jest-snapshot/build/plugins';
import {
  bReceivedColor,
  matcherHintFromConfig,
  printSnapshotAndReceived,
} from 'jest-snapshot/build/printSnapshot';
import { escapeBacktickString, serialize } from 'jest-snapshot/build/utils';

import SnapshotState from './State';

export type SnapshotMatcherState = MatcherState & {
  snapshot: SnapshotState;
  currentTestPath: string[];
  index: number;
};

const printSnapshotName = (
  concatenatedBlockNames = '',
  hint = '',
  count: number,
): string => {
  const hasNames = concatenatedBlockNames.length !== 0;
  const hasHint = hint.length !== 0;

  return (
    // eslint-disable-next-line prefer-template
    'Snapshot name: `' +
    (hasNames ? escapeBacktickString(concatenatedBlockNames) : '') +
    (hasNames && hasHint ? ': ' : '') +
    (hasHint ? escapeBacktickString(hint) : '') +
    ' ' +
    count +
    '`'
  );
};

export default (expect: Expect) => {
  // eslint-disable-next-line no-param-reassign
  expect.addSnapshotSerializer = addSerializer;

  expect.extend({
    toMatchSnapshot(received: string, hint?: string) {
      // This adds leading and trailing newlines, which the deserializer
      //  removes.
      const serialized = serialize(received).trim();

      const {
        currentTestPath,
        snapshot,
        index,
      } = expect.getState() as SnapshotMatcherState;

      const nextIndex = index + 1;

      if (!hint) expect.setState({ index: nextIndex });

      const { actual, expected, pass } = snapshot.match(
        currentTestPath,
        hint || String(nextIndex),
        received,
      );

      if (pass) {
        return { message: () => '', pass: true };
      }

      const name = currentTestPath.join(' ');
      const config = {
        received,
        context: this,
        isInline: false,
        matcherName: 'toMatchSnapshot',
      };

      return {
        pass: false,
        actual: serialized,
        expected,
        message: !expected
          ? () =>
              `${matcherHintFromConfig(config, true)}\n\n${printSnapshotName(
                name,
                hint,
                nextIndex,
              )}\n\n` +
              `New snapshot was ${colors.bold(
                'not written',
              )}. The update flag ` +
              `must be explicitly passed to write a new snapshot.\n\n` +
              `This is likely because this test is run in a continuous integration ` +
              `(CI) environment in which snapshots are not written by default.\n\n` +
              `Received:${actual.includes('\n') ? '\n' : ' '}${bReceivedColor(
                actual,
              )}`
          : () =>
              `${matcherHintFromConfig(config, true)}\n\n${printSnapshotName(
                name,
                hint,
                nextIndex,
              )}\n\n${printSnapshotAndReceived(
                expected,
                actual,
                received,
                false,
              )}`,
      };
    },
  });
};
