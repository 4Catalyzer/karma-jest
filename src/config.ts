import path from 'path';

import defaults from 'lodash/defaults';

export interface Config {
  rootDir: string;
  snapshotPath: string;
  setupFilesAfterEnv: string[];
  setupFiles: string[];
  testMatch: string[];
  testPathIgnorePatterns: string[];
  update: 'new' | 'all' | false;
}

export const defaultConfig = {
  snapshotPath: '__snapshots__',
  setupFiles: [],
  setupFilesAfterEnv: [],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['**/node_modules/**'],
};

export function normalizeConfig(
  { singleRun, basePath }: { singleRun: boolean; basePath: string },
  config: Partial<Config>,
) {
  // console.log('H', path.resolve(basePath, config.rootDir || './'));
  const jest: Config = defaults(config, {
    rootDir: basePath,
    update: singleRun ? false : 'new',
    ...defaultConfig,
  });
  if (!path.isAbsolute(jest.rootDir))
    jest.rootDir = path.resolve(basePath, jest.rootDir);

  return jest;
}
