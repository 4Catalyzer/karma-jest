## karma-jest

A Karma framework for using Jest's best features in a browser.

## Install

```sh
npm i karma-jest -D
```

Or with yarn

```sh
yarn add karma-jest -D
```

## Usage

In your karma config:

```js
module.exports = (config) => {
  config.set({
    plugins: ['karma-jest'],
    frameworks: ['jest'],
    reporters: ['jest'],

    // Add options (defaults below)
    jest: {
      snapshotPath: '__snapshots__',
      testMatch: [
        '**/__tests__/**/*.[jt]s?(x)',
        '**/?(*.)+(spec|test).[jt]s?(x)',
      ],
      testPathIgnorePatterns: ['**/node_modules/**'],
    },
  });
};
```

### Options

At the moment karma-jest supports a limited subset of jest options on the `jest`:

- `testMatch`: an array of glob patterns to select test files
- `testPathIgnorePatterns`: an array of patterns matching ignored files
- `snapshotPath`: the directory snapshots are saved in, defaults to: `path.join(karmaConfig.basePath, '__snapshots__')`

Internally `karma-jest` uses `webpack` to compile and run tests. Reasonable defaults
are provided for compiling JS, CSS, and various font and image assets. To customize the webpack
configuration you can specify any config via the **top level** `webpack` option in your karma config.
The config will be merged into the default config via `webpack-merge`. For complete control
over the configuration, pass a function:

```js
{
  webpack: (defaultConfig) => ({
    ...defaultConfig,
    plugins: [new MyPlugin(), ...defaultConfig.plugins],
  });
}
```

Watch out! you can easily break karma jest this way.

### Differences from Jest

Because a browser is very different environment from Node, there are a few
key differences with how `karma-jest` works compared to Jest.

- Compiling and bundling test files is up to you. Use whichever Karma preprocessor
  is appropriate for your project, probably `karma-webpack` or `karma-preprocessor-rollup`.
- Tests are considered as a whole across all test files this means `.only` tests apply to the entire test suite, and snapshots are located in a **single directory** organized by suite name, instead of file name.
- Dynamic module mocking does **not** work yet! However you **can** use auto module mocking via `__mocks__` directories
