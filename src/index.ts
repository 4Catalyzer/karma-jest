/* eslint-disable no-param-reassign */
import { readFileSync } from 'fs';
import path from 'path';

import glob from 'glob';
import groupBy from 'lodash/groupBy';

import Reporter, { browserShortName } from './circus-reporter';
import * as Compile from './compile';
import { Config, normalizeConfig } from './config';
import * as Serializer from './snapshot/Serializer';

const createPattern = (pattern: string): any => ({
  pattern,
  type: 'js',
  included: true,
  served: true,
  watched: false,
});

function initCircus(
  karmaConfig: any,
  partialJest: Partial<Config> = {},
  files: any[],
  preprocessors: any,
) {
  const jest = normalizeConfig(karmaConfig, partialJest);

  karmaConfig.customDebugFile = require.resolve('./assets/debug.html');

  const adapter = require.resolve('./circus-adapter.ts');

  files.unshift({
    pattern: path.join(path.dirname(adapter), `${path.basename(adapter)}.map`),
    served: true,
    included: false,
    watched: false,
  });

  files.unshift(createPattern(adapter));

  // files.push({
  //   pattern: path.join(jest.rootDir, '**/*.js.map'),
  //   included: false,
  //   watched: false,
  //   served: true,
  // });

  [...jest.setupFiles, ...jest.setupFilesAfterEnv, ...jest.testMatch].forEach(
    (pattern) => {
      preprocessors[path.join(jest.rootDir, pattern)] = ['jest-compiler'];
    },
  );

  karmaConfig.beforeMiddleware = karmaConfig.beforeMiddleware || [];
  karmaConfig.beforeMiddleware.push('jest-snapshot');

  Compile.registerExtraWebpackFiles(karmaConfig, jest);
}

initCircus.$inject = [
  'config',
  'config.jest',
  'config.files',
  'config.preprocessors',
];

function createMiddleware(
  karmaConfig: any,
  partialJest: Partial<Config> = {},
  basePath: string,
) {
  const jest = normalizeConfig(karmaConfig, partialJest);

  const snapGlob = path.isAbsolute(jest.snapshotPath)
    ? `${jest.snapshotPath}/**/*.md`
    : path.join(basePath, `${jest.snapshotPath}/**/*.md`);

  const snapshotsByBrowser = groupBy(glob.sync(snapGlob), (file) => {
    const parts = path.basename(file, '.md').split('__');

    return parts.pop()!;
  });

  return (req: any, res: any, next: () => void) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname.includes('snapshot')) {
      const browser = browserShortName(
        req.headers['user-agent'] || req.headers['User-Agent'],
      );

      const json = JSON.stringify(
        (snapshotsByBrowser[browser!] || []).map((file) => {
          const root = Serializer.deserialize(readFileSync(file, 'utf-8'));
          return [
            root.name,
            {
              name: root.name,
              snapshots: Array.from(root.snapshots),
            },
          ];
        }),
      );

      res.setHeader('Content-Type', 'application/json');
      res.end(json);
      return;
    }

    next();
  };
}

createMiddleware.$inject = ['config', 'config.jest', 'config.basePath'];

module.exports = {
  'framework:jest': ['factory', initCircus],
  'reporter:jest': ['type', Reporter],
  'middleware:jest-snapshot': ['factory', createMiddleware],
  'preprocessor:jest-compiler': ['factory', Compile.compilerPreprocessor],
};
