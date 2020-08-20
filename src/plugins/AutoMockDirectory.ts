import path from 'path';
/**
 * A webpack plugin that implements the manual __mocks__ directory from
 * jest for mocking packages
 */
export default class AutoMockDirectoryPlugin {
  constructor(readonly rootPath = process.cwd()) {}

  apply(resolver: any) {
    const fs = resolver.fileSystem;

    function getMockFile(dirname: string, fileName: string) {
      try {
        const files = fs.readdirSync(path.join(dirname, '__mocks__'));
        const baseName = files.find(
          (f: string) => path.basename(f, path.extname(f)) === fileName,
        );

        const file = baseName && path.join(dirname, '__mocks__', baseName);

        if (file && fs.statSync(file)) return path.normalize(file);
      } catch {
        /* ignore */
      }

      return null;
    }

    resolver.hooks.relative.tapAsync(
      'automocking',
      (
        request: any,
        _stack: string[],
        callback: (err: any, result: any) => void,
      ) => {
        const { issuer } = request.context;
        let dirname = path.dirname(request.path);
        const fileName = path.basename(
          request.path,
          path.extname(request.path),
        );

        if (dirname.endsWith('node_modules')) {
          dirname = this.rootPath;
        } else if (dirname.includes('/node_modules/')) {
          resolver.doResolve(
            resolver.hooks.describedRelative,
            request,
            null,
            {},
            callback,
          );
          return;
        }

        let mockPath = getMockFile(dirname, fileName);

        if (mockPath) {
          if (mockPath.includes('/node_modules/')) {
            mockPath = null;
          } else if (issuer && path.normalize(issuer) === mockPath) {
            mockPath = null;
          }
        }

        resolver.doResolve(
          resolver.hooks.describedRelative,
          { ...request, path: mockPath || request.path },
          null,
          {},
          callback,
        );
      },
    );
  }
}
