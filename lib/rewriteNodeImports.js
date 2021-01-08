const { URL } = require("url");
const { nodeResolve } = require("@rollup/plugin-node-resolve");

const escapeRegExp = require("./escapeRegExp");
const walkUpToModule = require("./walkUpToModule");

const identifyRegex = /from[ ]*['"](.*?)['"]/g;

function createReplaceRegex(importRef) {
    return new RegExp(`(from[ ]*['"])(${escapeRegExp(importRef)})(['"])`);
}

async function rewriteNodeImports(source, rootDir) {
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
}

module.exports = rewriteNodeImports;
module.exports.safe = async (source, outputDir) => {
    try {
        const output = await rewriteNodeImports(source, outputDir);
        if (output === "") return source;
        return output;
    } catch {
        return null;
    }
};
