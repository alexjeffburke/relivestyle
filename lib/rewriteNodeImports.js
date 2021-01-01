const { nodeResolve } = require("@rollup/plugin-node-resolve");

const escapeRegExp = require("./escapeRegExp");
const walkUpToModule = require("./walkUpToModule");

const identifyRegex = /from ['"](.*?)['"]/g;

const createReplaceRegex = importRef =>
    new RegExp(`(from ['"])(${escapeRegExp(importRef)})(['"])`);

module.exports = async function(source, rootDir) {
    const importRefs = Array.from(source.matchAll(identifyRegex))
        .map(lineMatch => lineMatch[1])
        .filter(maybeNodeImport => /^[a-z@]/.test(maybeNodeImport));

    if (importRefs.length === 0) {
        return "";
    }

    const moduleResolver = nodeResolve({
        rootDir,
        mainFields: ["module", "browser"]
    });

    for (const importRef of importRefs) {
        const resolved = await moduleResolver.resolveId(importRef);
        if (!resolved) throw new Error("unable to resolve module");
        const modulePath = resolved.id;
        const {
            moduleName,
            moduleFilePath
        } = walkUpToModule.walkUpToModuleAndFile(modulePath);

        const replaceRegex = createReplaceRegex(importRef);
        const rewrittenRef = `/__node_modules/${moduleName}${moduleFilePath}`;

        source = source.replace(
            replaceRegex,
            (_, $1, $2, $3) => `${$1}${rewrittenRef}${$3}`
        );
    }

    return source;
};
