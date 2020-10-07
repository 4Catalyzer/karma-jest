/* eslint-disable no-param-reassign */
import fs from 'fs';
import path from 'path';

import glob from 'glob';
import { FilePattern } from 'karma';

import WebpackController from './WebpackController';
import { Config } from './config';

export const controller = new WebpackController();

/**
 * Simple hash function by bryc
 * https://gist.github.com/iperelivskiy/4110988#gistcomment-2697447
 */
function hash(s: string) {
  let h = 0xdeadbeef;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 2654435761); // eslint-disable-line no-bitwise
  }
  return (h ^ (h >>> 16)) >>> 0; // eslint-disable-line no-bitwise
}

function getPathKey(filePath: string, withExtension = false) {
  const pathParts = path.parse(filePath);
  const key = `${pathParts.name}.${hash(filePath)}`;
  return withExtension ? `${key}${pathParts.ext}` : key;
}

export function registerExtraWebpackFiles(
  { files, autoWatch }: KarmaConfig,
  jest: Config,
) {
  const commonsPath = path.join(controller.outputPath, 'commons.js');
  const runtimePath = path.join(controller.outputPath, 'runtime.js');

  // make sure tmp folder exists
  if (!fs.existsSync(controller.outputPath)) {
    fs.mkdirSync(controller.outputPath);
  }

  // create dummy files for commons.js and runtime.js so they get included by karma
  fs.closeSync(fs.openSync(commonsPath, 'w'));
  fs.closeSync(fs.openSync(runtimePath, 'w'));

  // register for karma
  files.unshift({
    pattern: commonsPath,
    included: true,
    served: true,
    watched: false,
  });

  const resolvedRoot = path.resolve(jest.rootDir);
  const webpackEntries: Record<string, string> = {};

  // put before the adapter
  jest.setupFiles.forEach((filePath) => {
    const resolved = path.join(resolvedRoot, filePath);
    files.unshift({
      type: 'js',
      watched: false,
      pattern: resolved,
    });
    webpackEntries[getPathKey(resolved)] = resolved;
  });

  files.unshift({
    pattern: runtimePath,
    included: true,
    served: true,
    watched: false,
  });

  // after adapter
  jest.setupFilesAfterEnv.forEach((filePath) => {
    const resolved = path.join(resolvedRoot, filePath);
    files.push({
      type: 'js',
      watched: false,
      pattern: resolved,
    });

    webpackEntries[getPathKey(resolved)] = resolved;
  });

  const loader = require.resolve('imports-loader');
  jest.testMatch!.forEach((pattern) => {
    glob
      .sync(pattern, {
        cwd: resolvedRoot,
        ignore: jest.testPathIgnorePatterns,
      })
      .forEach((filePath) => {
        const resolved = path.join(resolvedRoot, filePath);

        files.push({
          type: 'js',
          watched: false,
          pattern: resolved,
        });

        webpackEntries[
          getPathKey(resolved)
        ] = `${loader}?{"additionalCode":"__runnerState__.getState().testFile='${filePath}';"}!${resolved}`;
      });
  });

  if (controller.isActive === false) {
    Object.assign(controller.webpackOptions, {
      entry: webpackEntries,
      watch: autoWatch,
      context: resolvedRoot,
    });
  }
  return webpackEntries;
}

type KarmaConfig = {
  files: FilePattern[];
  basePath: string;
  jest: Config;
  autoWatch?: boolean;
};

const normalize = (file: string) => file.replace(/\\/g, '/');

// the output files are JS regardless of the input extension
function transformPath(filepath: string) {
  const info = path.parse(filepath);
  return `${path.join(info.dir, info.name)}.js`;
}

export function compilerPreprocessor(config: any, emitter: any) {
  if (controller.isActive === false) {
    controller.configure(emitter, config.basePath, config.webpack || {});
  }

  return async function processFile(_: any, file: any, done: any) {
    try {
      await controller.bundle();

      const filepath = normalize(file.path);
      const key = `${getPathKey(filepath)}.js`;
      const bundleContent = controller.bundlesContent[key];

      file.path = transformPath(filepath);

      if (!bundleContent) {
        done(new Error(`Webpack did not return a result for ${file.path}`));
      } else {
        done(null, bundleContent);
      }
    } catch (err) {
      done(err);
    }
  };
}

registerExtraWebpackFiles.$inject = ['config'];
compilerPreprocessor.$inject = ['config', 'emitter'];
