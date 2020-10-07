/* eslint-disable max-classes-per-file */

import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';

import webpack from 'webpack';
// @ts-ignore
import { loaders, plugins, rules } from 'webpack-atoms';
import webpackMerge from 'webpack-merge';

import AutoMockDirectoryPlugin from './plugins/AutoMockDirectory';

class KarmaSyncPlugin {
  constructor(
    private karmaEmitter: any,
    private controller: WebpackController,
  ) {}

  apply(compiler: webpack.Compiler) {
    // webpack bundles are finished
    compiler.hooks.done.tap('KarmaSyncPlugin', (stats) => {
      // read generated file content and store for karma preprocessor
      this.controller.bundlesContent = {};

      stats.toJson()?.assets?.forEach((webpackFileObj) => {
        const filePath = `${compiler.options.output!.path}/${
          webpackFileObj.name
        }`;
        this.controller.bundlesContent[webpackFileObj.name] = fs.readFileSync(
          filePath,
          'utf-8',
        );
      });

      // karma refresh
      this.karmaEmitter.refreshFiles();
    });
  }
}

class WebpackController extends EventEmitter {
  public webpackOptions: webpack.Configuration;

  public bundlesContent: Record<string, string>;

  public isActive: boolean;

  hasBeenBuiltAtLeastOnce: boolean;

  private activePromise?: Promise<unknown>;

  private compiler?: webpack.Compiler;

  private webpackFileWatcher: any;

  get outputPath() {
    return this.webpackOptions.output!.path!;
  }

  constructor() {
    super();
    this.isActive = false;
    this.bundlesContent = {};
    this.hasBeenBuiltAtLeastOnce = false;
    this.webpackOptions = {
      output: {
        filename: '[name].js',
        path: path.join(os.tmpdir(), '_karma_webpack_'),
      },
      mode: 'development' as const,
      devtool: 'inline-source-map' as const,
      // stats: 'minimal' as const,
      watch: false,
      optimization: {
        runtimeChunk: 'single' as const,
        splitChunks: {
          chunks: 'all' as const,
          minSize: 0,
          cacheGroups: {
            commons: {
              name: 'commons',
              chunks: 'all' as const,
              minChunks: 1,
            },
          },
        },
      },
      module: {
        rules: [
          { ...rules.js(), test: /\.[j|t]sx?$/ },
          rules.css({ extract: false }),
          {
            oneOf: [
              { test: /\.svg$/, use: loaders.url() },
              rules.fonts(),
              rules.audioVideo(),
              rules.images(),
            ],
          },
        ],
      },
    };
  }

  configure(
    karmaEmitter: any,
    basePath: string,
    userConfig?:
      | webpack.Configuration
      | ((config: webpack.Configuration) => webpack.Configuration),
  ) {
    const defaultConfig = {
      ...this.webpackOptions,
      resolve: {
        symlinks: false,
        modules: ['node_modules'],
        extensions: ['.mjs', '.js', '.ts', '.tsx', '.json'],
        plugins: [new AutoMockDirectoryPlugin(path.resolve(basePath))],
        alias: {
          'chalk': require.resolve('./shims/chalk'),
          'ansi-styles': require.resolve('./shims/ansi-styles'),
        },
      },
      plugins: [
        plugins.define({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'process.env.NODE_ENV': '"test"',
        }),
        new KarmaSyncPlugin(karmaEmitter, this),
        new webpack.ProgressPlugin((percentage, message, ...args) => {
          this.emit('build:progress', percentage, message, ...args);
        }),
      ],
    };

    // eslint-disable-next-line no-nested-ternary
    this.webpackOptions = userConfig
      ? typeof userConfig === 'function'
        ? userConfig(defaultConfig)
        : webpackMerge(defaultConfig, userConfig)
      : defaultConfig;

    karmaEmitter.on('exit', (done: () => void) => {
      this.onKarmaExit();
      done();
    });
  }

  bundle() {
    if (!this.isActive && !this.hasBeenBuiltAtLeastOnce) {
      this.emit('build:started');

      this.isActive = true;
      this.compiler = webpack(this.webpackOptions);
      this.activePromise = new Promise((resolve) => {
        if (this.webpackOptions.watch === true) {
          this.emit('watch:start');
          // console.log('Webpack starts watching...');
          this.webpackFileWatcher = this.compiler!.watch({}, (err, stats) =>
            this.handleBuildResult(err, stats, resolve),
          );
        } else {
          this.compiler!.run((err, stats) =>
            this.handleBuildResult(err, stats, resolve),
          );
        }
      });
    }
    return this.activePromise;
  }

  handleBuildResult(
    err: Error | null,
    stats: webpack.Stats,
    resolve: (value?: unknown) => void,
  ) {
    if (err) {
      this.emit('build:failed', err);
      return;
    }

    const info = stats.toJson();

    if (stats.hasErrors()) {
      this.emit('build:errors', info.errors);
    }
    if (stats.hasWarnings()) {
      this.emit('build:warnings', info.warnings);
    }

    this.isActive = false;
    this.hasBeenBuiltAtLeastOnce = true;
    this.emit('build:done');
    resolve();
  }

  onKarmaExit() {
    if (this.webpackFileWatcher) {
      this.webpackFileWatcher.close();
      this.emit('watch:end');
    }
  }
}

export default WebpackController;
