/* eslint-disable no-param-reassign */
import path from 'path';

import StackParser from 'error-stack-parser';
import { separateMessageFromStack } from 'jest-message-util';
import { RawSourceMap, SourceMapConsumer } from 'source-map';

const cache = new WeakMap<any, SourceMapConsumer>();
async function getSourceMapConsumer(sourceMap: RawSourceMap) {
  if (!cache.has(sourceMap)) {
    cache.set(sourceMap, await new SourceMapConsumer(sourceMap));
  }
  return cache.get(sourceMap)!;
}

export interface SourceFile {
  path: string;
  sourceMap?: RawSourceMap;
}

async function mapLocation(
  frame: StackParser.StackFrame,
  basePath: string,
  files: SourceFile[],
) {
  const { fileName, lineNumber: line = 0, columnNumber: column = 0 } = frame;
  try {
    const url = new URL(fileName!);
    const filePath = url.pathname.replace('/base/', `${basePath}/`);
    const file = files.find(f => f.path === filePath);

    frame.fileName = filePath;

    if (!file || !file.sourceMap || !line) {
      return frame.source?.replace(fileName!, filePath);
    }

    const sourceMap = await getSourceMapConsumer(file.sourceMap);

    const original = sourceMap.originalPositionFor({
      line,
      column,
      bias: column
        ? SourceMapConsumer.GREATEST_LOWER_BOUND
        : SourceMapConsumer.LEAST_UPPER_BOUND,
    });

    if (!original) {
      return frame.source?.replace(fileName!, filePath);
    }

    frame.source = frame.source
      ?.replace(
        fileName!,
        original.source ? path.join(basePath, original.source) : filePath,
      )
      .replace(`:${line}`, `:${original.line}`)
      .replace(`:${column}`, `:${original.column}`);
  } catch {
    /* ignore */
  }

  return frame.source;
}

export async function cleanStack(
  error: string,
  basePath: string,
  sourceFiles: SourceFile[],
) {
  const { stack, message } = separateMessageFromStack(error);

  const lines = await Promise.all(
    StackParser.parse({ stack, message, name: '' }).map(f =>
      mapLocation(f, basePath, sourceFiles),
    ),
  );
  return `${message}\n${lines.join('\n')}`;
}
