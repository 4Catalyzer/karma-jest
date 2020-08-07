/* eslint-disable max-classes-per-file */

import prettyFormat from 'pretty-format';

import { LogType } from './types';

class ErrorWithStack extends Error {
  constructor(message: string | undefined) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
  }
}

let original: typeof console;

const printOptions = {
  maxDepth: 5,
  plugins: Object.values(prettyFormat.plugins),
};

export default class Console {
  // eslint-disable-next-line no-underscore-dangle
  private karma = window.__karma__;

  static proxy() {
    original = window.console;
    const proxiedConsole = new Console();

    if (
      proxiedConsole.karma.isDEBUG ||
      proxiedConsole.karma.config.jestCaptureConsole === false
    ) {
      return original;
    }

    ['log', 'info', 'warn', 'error', 'debug'].forEach(
      (type: keyof typeof original & LogType) => {
        const method = original[type];

        window.console[type] = (...args: any[]) => {
          proxiedConsole[type](...args);
          method.call(original, ...args);
        };
      },
    );

    return proxiedConsole;
  }

  private write(type: LogType, args: any[]) {
    const { stack } = new ErrorWithStack(undefined);
    const origin = stack!.split('\n').slice(5).filter(Boolean).join('\n');

    this.karma.info({
      jestType: 'log',
      payload: {
        message: args.map((a) => prettyFormat(a, printOptions)).join(' '),
        type,
        origin,
      },
    });
  }

  log(...args: any[]) {
    this.write('log', args);
  }

  info(...args: any[]) {
    this.write('info', args);
  }

  warn(...args: any[]) {
    this.write('warn', args);
  }

  error(...args: any[]) {
    this.write('error', args);
  }

  debug(...args: any[]) {
    this.write('debug', args);
  }
}
