/* eslint-disable no-param-reassign */
import path from 'path';

import Reporter, { Config } from './circus-reporter';
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
  jest: Config,
  basePath: string,
  files: any[],
  preprocessors: any,
) {
  karmaConfig.customDebugFile = require.resolve('./assets/debug.html');

  jest.snapshotPath = jest.snapshotPath || '__snapshots__';

  const snapGlob = path.isAbsolute(jest.snapshotPath)
    ? `${jest.snapshotPath}/**/*.md`
    : path.join(basePath, `${jest.snapshotPath}/**/*.md`);

  files.unshift(createPattern(snapGlob));
  files.unshift(createPattern(require.resolve('./circus-adapter.ts')));

  preprocessors[snapGlob] = ['jest-snapshot'];
}

initCircus.$inject = [
  'config',
  'config.jest',
  'config.basePath',
  'config.files',
  'config.preprocessors',
];

function snapshotPreprocessor() {
  return (content: string, _: any, done: any) => {
    const root = Serializer.deserialize(content);
    const serialized = JSON.stringify(root.name);
    done(
      `((window) => {
  var snaps = window.__snapshots__ || { suites: new Map() };
  window.__snapshots__ = snaps;
  snaps.suites.set(
    ${serialized},
    {
      name: ${serialized},
      snapshots: new Map(${JSON.stringify(Array.from(root.snapshots))})
    }
  );
})(window);
`,
    );
  };
}

module.exports = {
  'framework:jest': ['factory', initCircus],
  'reporter:jest': ['type', Reporter],
  'preprocessor:jest-snapshot': ['factory', snapshotPreprocessor],
};
