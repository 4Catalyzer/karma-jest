const alias = require('@rollup/plugin-alias');
const replace = require('@rollup/plugin-replace');
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const resolve = require('rollup-plugin-node-resolve');
// const visualizer = require('rollup-plugin-visualizer');

module.exports = [
  {
    input: 'src/circus-adapter.ts',
    output: {
      file: 'lib/circus-adapter.js',
      format: 'iife',
      intro:
        'const process = { env: {}, cwd: () => "/" };\n' +
        'const Buffer = () => {}',
      sourcemap: true,
    },
    plugins: [
      replace({
        'process.env.NODE_ENV': JSON.stringify('production'),
      }),
      alias({
        entries: {
          'chalk': require.resolve('ansi-colors'),
          'ansi-styles': require.resolve('./src/shims/ansi-styles.js'),
          'micromatch': require.resolve('./src/shims/micromatch.js'),

          // Node builtins
          'assert': require.resolve('./src/shims/assert.js'),
          'fs': require.resolve('./src/shims/empty-obj.js'),
          'module': require.resolve('./src/shims/empty-obj.js'),
          'process': require.resolve('./src/shims/empty-obj.js'),
          'path': require.resolve(
            'rollup-plugin-node-polyfills/polyfills/path',
          ),
          'util': require.resolve(
            'rollup-plugin-node-polyfills/polyfills/util',
          ),
          // these are packages we've aliased and patched
          // the reason for the yarn alias is so both the original
          // and patched versions can exist during dev runs.
          'jest-util': 'browser-jest-util',
          'jest-snapshot': 'browser-jest-snapshot',
          'jest-message-util': 'browser-jest-message-util',
        },
      }),
      resolve({ browser: false, extensions: ['.js', '.ts'] }),
      babel({ extensions: ['.js', '.ts'] }),
      commonjs(),
      // visualizer(),
    ],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'lib/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    external: (id) =>
      !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'),
    plugins: [
      replace({
        'process.env.NODE_ENV': JSON.stringify('production'),
      }),
      replace({
        'delimiters': ["'", "'"],
        './circus-adapter.ts': '"./circus-adapter"',
      }),
      resolve({
        browser: false,
        extensions: ['.js', '.ts'],
        preferBuiltins: true,
      }),
      babel({ extensions: ['.js', '.ts'] }),
      commonjs(),
    ],
  },
];
