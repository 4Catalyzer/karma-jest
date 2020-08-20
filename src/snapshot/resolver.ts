export default {
  // resolves from test to snapshot path
  resolveSnapshotPath: (
    testPath: string,
    browser: string,
    snapshotExtension: string,
  ) =>
    `${testPath.replace(
      '__tests__',
      '__snapshots__',
    )}__${browser}${snapshotExtension}`,

  // resolves from snapshot to test path
  resolveTestPath: (
    snapshotFilePath: string,
    browser: string,
    snapshotExtension: string,
  ) =>
    snapshotFilePath
      .replace('__snapshots__', '__tests__')
      .slice(0, -`__${browser}${snapshotExtension}`.length),
};
