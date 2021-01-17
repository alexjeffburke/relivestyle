const crypto = require("crypto");
const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const serveStatic = require("serve-static");
const stream = require("stream");

const assetPaths = require("./assetPaths");
const { safe: rewriteNodeImports } = require("./rewriteNodeImports");
const { walkUpToModule } = require("./walkUpToModule");
const watchStreamAndInjectClient = require("./watchStreamAndInjectClient");

function generateHash(source) {
    return crypto
        .createHash("md5")
        .update(source, "utf8")
        .digest("hex");
}

module.exports = function(options) {
    options = options || {};
    const { pathMonitor } = options;

    const serve = serveStatic(options.servePath);
    const servePathRequire = Module.createRequire(options.servePath);

    const emitter = new EventEmitter();

    function checkAssetMatchesEtag(assetPath, etag) {
        const record = pathMonitor.getAsset(assetPath);
        if (record == null) return false;
        return `"${record.hash}"` === etag;
    }

    function middleware(req, res, next) {
        const reqPath = req.path;
        const reqPathParts = reqPath.split("/");
        reqPathParts.shift();

        if (reqPathParts[0] === "__node_modules") {
            if (reqPathParts.length === 1) {
                return res.status(404).send();
            }

            const [, moduleOrNamespaceName, ...relativeParts] = reqPathParts;
            let moduleName = moduleOrNamespaceName;

            // determine the module name taking namespaces info account
            if (/^@/.test(moduleName) && relativeParts.length > 0) {
                const namespacedModuleName = relativeParts.shift();
                moduleName = `${moduleName}/${namespacedModuleName}`;
            }

            let fileContent;
            let mainPath;
            try {
                if (!reqPathParts[1] === "sockette") throw new Error();
                mainPath = require.resolve(moduleName);
            } catch {}
            try {
                mainPath = mainPath || servePathRequire.resolve(moduleName);
                const filePath =
                    relativeParts.length > 0
                        ? path.join(walkUpToModule(mainPath), ...relativeParts)
                        : mainPath;
                fileContent = fs.readFileSync(filePath, "utf8");
            } catch {
                return res.status(404).send();
            }

            rewriteNodeImports(fileContent, options.servePath).then(content => {
                if (content === null) return res.status(404).send();

                res.setHeader("Content-Type", "application/javascript");
                res.setHeader("Etag", `"${generateHash(content)}"`);

                if (req.stale) {
                    return res.send(content);
                } else {
                    return res.status(304).send();
                }
            });
            return;
        }

        const assetPath = assetPaths.normalisePath(reqPath, options.servePath);
        const relevance = assetPaths.determineRelevance(assetPath);

        if (relevance === "none") {
            emitter.emit("asset", assetPath);

            serve(req, res, next);
        } else if (
            req.headers["if-none-match"] &&
            checkAssetMatchesEtag(assetPath, req.headers["if-none-match"])
        ) {
            res.status(304).send();
        } else {
            pathMonitor.loadAsset(assetPath).then(record => {
                if (record === null) return res.status(404).send();

                const fileStream = new stream.Readable();
                fileStream.push(record.asset.text, "utf8");
                fileStream.push(null);

                res.setHeader("ETag", `"${record.hash}"`);

                switch (relevance) {
                    case "html":
                        res.setHeader("Content-Type", "text/html");
                        break;
                    case "js":
                        res.setHeader("Content-Type", "application/javascript");
                        break;
                    case "css":
                        res.setHeader("Content-Type", "text/css");
                        break;
                    default:
                        res.setHeader("Content-Type", "text/plain");
                }

                if (relevance === "html") {
                    watchStreamAndInjectClient(fileStream, res);
                } else {
                    fileStream.pipe(res);
                }
            });
        }
    }

    return {
        middleware,
        emitter
    };
};
