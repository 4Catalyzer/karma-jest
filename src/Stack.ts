/* eslint-disable no-param-reassign */
import { existsSync, promises as fs } from 'fs';
import path from 'path';

import StackParser from 'error-stack-parser';
import { separateMessageFromStack } from 'jest-message-util';
import { RawSourceMap, SourceMapConsumer } from 'source-map';

const sourcemapUrlRegeExp = /^\/\/#\s*sourceMappingURL=/;
const charsetRegex = /^;charset=([^;]+);/;

function parseSourceMap(content: string) {
  function inlineMap(inlineData: string) {
    let charset = 'utf-8';

    if (charsetRegex.test(inlineData)) {
      const matches = inlineData.match(charsetRegex);

      if (matches?.length === 2) {
        charset = matches[1];
        inlineData = inlineData.slice(matches[0].length - 1);
      }
    }

    if (!/^;base64,/.test(inlineData)) throw new Error('not base64');

    // base64-encoded JSON string
    const buffer = Buffer.from(inlineData.slice(';base64,'.length), 'base64');
    return JSON.parse(buffer.toString(charset));
  }

  const lines = content.split(/\n/);
  let lastLine = lines.pop();
  while (/^\s*$/.test(lastLine!)) {
    lastLine = lines.pop();
  }

  let mapUrl;
  if (sourcemapUrlRegeExp.test(lastLine!)) {
    mapUrl = lastLine!.replace(sourcemapUrlRegeExp, '');
  }

  if (!mapUrl) return {};

  if (/^data:application\/json/.test(mapUrl)) {
    return {
      sourceMap: inlineMap(mapUrl.slice('data:application/json'.length)),
    };
  }
  return { url: mapUrl };
}

const cache = new WeakMap<any, SourceMapConsumer>();

function cleanUrl(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

async function getSourceMapConsumer(sourceMap: RawSourceMap) {
  if (!cache.has(sourceMap)) {
    cache.set(sourceMap, await new SourceMapConsumer(sourceMap));
  }
  return cache.get(sourceMap)!;
}

export async function getSourceMap(content: string) {
  const { url, sourceMap } = parseSourceMap(content);

  if (url && existsSync(url)) {
    return JSON.parse(await fs.readFile(url, 'utf-8'));
  }

  return sourceMap;
}

export interface SourceFile {
  path: string;
  originalPath: string;
  content: string | null;
  mtime: string;
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
    const filePath = url.pathname
      .replace('/base/', `${basePath}/`)
      .replace('/absolute/', `/`);

    const file = files.find((f) => f.path === filePath);

    frame.fileName = filePath;

    if (file?.content && !file.sourceMap) {
      file.sourceMap = await getSourceMap(file.content);
    }

    if (!file?.sourceMap || !line) {
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
        original.source
          ? path.join(basePath, cleanUrl(original.source))
          : filePath,
      )
      .replace(`:${line}`, `:${original.line}`)
      .replace(`:${column}`, `:${original.column}`);
  } catch (err) {
    console.error(err);
    /* ignore */
  }

  return frame.source;
}

export async function cleanStack(
  error: any,
  basePath: string,
  sourceFiles: SourceFile[],
) {
  const { stack, message = '' } =
    typeof error === 'string' ? separateMessageFromStack(error) : error;

  if (!stack) return String(message || '');

  const lines = await Promise.all(
    StackParser.parse({ stack, message, name: '' }).map((f) =>
      mapLocation(f, basePath, sourceFiles),
    ),
  );

  return `${message}\n${lines.join('\n')}`;
}
