import { Circus } from '@jest/types';
import RunnerState from 'jest-circus/build/state';

export default function getTestPath(test: Circus.TestEntry) {
  const path = [test.name];
  let pointer = test.parent;
  while (pointer && pointer.name !== RunnerState.ROOT_DESCRIBE_BLOCK_NAME) {
    path.unshift(pointer.name);
    pointer = pointer.parent!;
  }

  return path;
}
