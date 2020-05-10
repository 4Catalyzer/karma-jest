## karma-jest

A Karma framework for using some of Jest's best features in a browser.

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
    // add your test files
    files: ['test/**/*.test.js'],

    plugins: ['karma-jest'],
    frameworks: ['jest'],
    reporters: ['jest'],

    // Add options
    jest: {
      snapshotPath: 'test/__snapshots__',
    },
  });
};
```

### Options

At the momement there is only one option:

- `snapshotPath`: the directory snapshots are saved in, defaults to: `path.join(karmaConfig.basePath, '__snapshots__')`

### Differences from Jest

Because a browser is very different environment from Node, there are a few
key differences with how `karma-jest` works compared to Jest.

- Compiling and bundling test files is up to you. Use whichever Karma preprocessor
  is appropriate for your project, probably `karma-webpack` or `karma-preprocessor-rollup`.
- Tests are organized by top level describe blocks instead of test files.
  this means `.only` tests apply to the entire test suite, and snapshots are located in a **single directory** organized by suite name, instead of file name.
- module mocking does **not** work! You can use something specific to your preprocessor if you need.
