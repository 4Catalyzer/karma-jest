interface KarmaClient {
  result(msg: {}): any;
  info(msg: {}): any;
  complete(msg: {}): any;

  start(): any;

  config?: any;
}

interface Window {
  __karma__: KarmaClient;
  __snapshots__: {
    suites: Map<string, import('./snapshot/types').SnapshotSuite>;
  };
}
