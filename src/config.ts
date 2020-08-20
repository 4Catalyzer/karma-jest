import defaults from 'lodash/defaults';

export interface Config {
  rootDir: string;
  snapshotPath: string;
  testMatch: string[];
  testPathIgnorePatterns: string[];
  update: 'new' | 'all' | false;
}

export const defaultConfig = {
  snapshotPath: '__snapshots__',
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['**/node_modules/**'],
};

export function normalizeConfig(
  { singleRun, basePath }: { singleRun: boolean; basePath: string },
  config: Partial<Config>,
) {
  const jest: Config = defaults(config, {
    rootDir: basePath,
    update: singleRun ? false : 'new',
    ...defaultConfig,
  });

  return jest;
}
