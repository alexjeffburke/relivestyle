const { URL } = require("url");
const { nodeResolve } = require("@rollup/plugin-node-resolve");

const escapeRegExp = require("./escapeRegExp");
const walkUpToModule = require("./walkUpToModule");

const identifyRegex = /from[ ]*['"](.*?)['"]/g;

function createReplaceRegex(importRef) {
  return new RegExp(`(from[ ]*['"])(${escapeRegExp(importRef)})(['"])`);
}

async function rewriteNodeImports(source, resolver) {
  const importRefs = [];

  for (const lineMatch of source.matchAll(identifyRegex)) {
    const maybeNodeImport = lineMatch[1];
    if (!/^[a-z@]/.test(maybeNodeImport)) continue;
    try {
      // eslint-disable-next-line no-new
      new URL(maybeNodeImport);
      // do not rewrite absolute urls
      continue;
    } catch {}
    importRefs.push(maybeNodeImport);
  }

  if (importRefs.length === 0) {
    return "";
  }

  for (const importRef of importRefs) {
    const resolved = await resolver.resolve(importRef);
    const replaceRegex = createReplaceRegex(importRef);
    const rewrittenRef = `/__node_modules/${resolved}`;

    source = source.replace(
      replaceRegex,
      (_, $1, $2, $3) => `${$1}${rewrittenRef}${$3}`
    );
  }

  return source;
}

class ImportResolver {
  constructor(options) {
    options = options || {};

    this.moduleResolver = nodeResolve({
      rootDir: options.servePath,
      mainFields: ["module", "browser"]
    });
  }

  async resolve(importRef) {
    const resolved = await this.moduleResolver.resolveId(importRef);
    if (!resolved) throw new Error("unable to resolve module");
    const modulePath = resolved.id;
    const { moduleName, moduleFilePath } = walkUpToModule.walkUpToModuleAndFile(
      modulePath
    );
    return `${moduleName}${moduleFilePath}`;
  }

  async rewrite(source) {
    return await rewriteNodeImports(source, this);
  }
}

module.exports = ImportResolver;
