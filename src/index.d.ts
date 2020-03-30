import { KarmaJest } from './circus-adapter';
import { Config as JestConfig } from './circus-reporter';

declare module 'karma' {
  interface ConfigOptions {
    jest?: Partial<JestConfig>;
  }
}

/**
 * Declare ambient viewport instance
 */
declare global {
  const karmaJest: KarmaJest;
}
