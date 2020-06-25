import fs from 'fs';
import path from 'path';

import marked from 'marked';

import { SnapshotSummary } from './State';
import { SerializedSnapshotSuite, Snapshot, SnapshotSuite } from './types';

/**
 * safeCodeFence tries to find a safe delimiter by appending backticks until it finally finds it.
 */
function safeCodeFence(s: string) {
  let delimiter = '```';
  while (s.includes(delimiter)) delimiter += '`';
  return delimiter;
}

export function deserialize(content: string): SnapshotSuite {
  const tokens = marked.lexer(content);
  const snapshots = new Map();

  let root = '';
  let snapshot: Snapshot | undefined;

  for (const token of tokens) {
    if (!('type' in token)) {
      continue;
    }

    switch (token.type) {
      case 'heading':
        if (token.depth === 1) root = token.text;
        if (token.depth === 2) {
          if (snapshot) snapshots.set(snapshot.name, snapshot);
          snapshot = { name: token.text, data: '' };
        }
        break;
      case 'code':
        snapshot!.lang = token.lang;
        snapshot!.data = token.text;
        break;
      default:
    }
  }

  if (snapshot) snapshots.set(snapshot.name, snapshot);
  return { name: root, snapshots };
}

export function serialize(suite: SerializedSnapshotSuite) {
  let content = `# ${suite.name}\n\n`;

  for (const snap of suite.snapshots) {
    const delim = safeCodeFence(snap.data);
    content += `## ${snap.name}\n\n`;
    content += `${delim}${snap.lang || ''}\n`;
    content += `${snap.data}\n`;
    content += `${delim}\n\n`;
  }

  return content;
}

export function save(
  resolver: (suiteName: string) => string,
  summary: SnapshotSummary,
  update: 'all' | 'new' | false,
) {
  let wrote = false;
  const hasNew = !summary.added && !summary.unmatched;
  const hasChanges =
    !!hasNew ||
    !!summary.updated ||
    !!summary.suitesRemoved ||
    !!summary.errored;

  // console.log('SAVE', update, hasChanges, summary);
  if (update === false) return wrote;
  if (update === 'new' && hasNew) return wrote;
  if (update === 'all' && !hasChanges) return wrote;

  for (const suite of summary.result) {
    const filepath = resolver(suite.name);
    console.log('HERE', filepath);
    if (!suite.snapshots.length) {
      fs.unlinkSync(resolver(suite.name));
      wrote = true;
    } else {
      wrote = true;
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, serialize(suite), 'utf-8');
    }
  }

  return wrote;
}
