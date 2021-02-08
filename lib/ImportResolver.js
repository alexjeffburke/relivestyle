const path = require("path");
const { URL } = require("url");
const { nodeResolve } = require("@rollup/plugin-node-resolve");

const debug = require("./debug").extend("ImportResolver");
const escapeRegExp = require("./escapeRegExp");
const { walkUpToModuleAndFile } = require("./walkUpToModule");

const identifyRegex = /from[ ]*['"](.*?)['"]/g;

function createReplaceRegex(importRef) {
  return new RegExp(`(from[ ]*['"])(${escapeRegExp(importRef)})(['"])`);
}

function escapeRelative(str) {
  const parts = str.split("/");

  let relativeCount = 0;
  for (const part of parts) {
    if (part !== "..") break;
    relativeCount += 1;
  }

  if (relativeCount > 0) {
    const remainingParts = parts.slice(relativeCount);
    return `~/${relativeCount}/${remainingParts.join("/")}`;
  } else {
    return str;
  }
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
    const rewrittenRef = `/__node_modules/${escapeRelative(resolved)}`;

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

    this.isMonorepo = !!options.isMonorepo;
    this.servePath = options.servePath;
    this.rootDir = options.rootDir || this.servePath;

    this.moduleResolver = nodeResolve({
      rootDir: this.servePath,
      mainFields: ["module", "browser"]
    });
  }

  derive(relativeDir) {
    return new ImportResolver({
      isMonorepo: this.isMonorepo,
      rootDir: this.servePath,
      servePath: path.join(this.rootDir, relativeDir)
    });
  }

  async resolve(importRef) {
    const resolved = await this.moduleResolver.resolveId(importRef);
    if (!resolved) throw new Error("unable to resolve module");
    const modulePath = resolved.id;
    const { moduleName, moduleFilePath } = walkUpToModuleAndFile(modulePath, {
      isMonorepo: this.isMonorepo,
      rootDir: this.rootDir
    });
    const resolvedRef = `${moduleName}${moduleFilePath}`;
    debug(`#resolve(): resolved ${importRef} -> ${resolvedRef}`);
    return resolvedRef;
  }

  async rewrite(source, contentPath) {
    debug(`#rewrite(): rewriting ${contentPath}`);
    try {
      const rewritten = await rewriteNodeImports(source, this);
      debug(`#rewrite(): rewriting successful`);
      return rewritten;
    } catch (e) {
      debug("#rewrite(): rewriting failure");
      debug(e.stack);
      throw e;
    }
  }
}

module.exports = ImportResolver;
