interface KarmaClient {
  isDEBUG?: boolean;

  result(msg: unknown): any;
  info(msg: unknown): any;
  complete(msg: unknown): any;

  start(): any;
  stringify(arg: any): string;
  config?: any;
}

interface Window {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __karma__: KarmaClient;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __snapshots__: {
    suites: Map<string, import('./snapshot/types').SnapshotSuite>;
  };
}
