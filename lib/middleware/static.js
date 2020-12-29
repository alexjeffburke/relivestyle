const crypto = require("crypto");
const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const serveStatic = require("serve-static");
const stream = require("stream");

const watchStreamAndInjectClient = require("../watchStreamAndInjectClient");

function generateHash(source) {
    return crypto
        .createHash("md5")
        .update(source, "utf8")
        .digest("hex");
}

function isFile(filePath) {
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile) {
            throw new Error("invalid");
        }
        return true;
    } catch (e) {
        return false;
    }
}

function walkUpToModule(modulePath) {
    const moduleDirParts = path.dirname(modulePath).split(path.sep);
    while (moduleDirParts.length > 1) {
        if (
            // normally installed modules
            moduleDirParts[moduleDirParts.length - 2] === "node_modules" ||
            // workaround to support the path to the frontend client code
            moduleDirParts[moduleDirParts.length - 1] === "relivestyle"
        ) {
            return moduleDirParts.join(path.sep);
        } else {
            moduleDirParts.pop();
        }
    }
    throw new Error("invalid module path");
}

module.exports = function(options) {
    options = options || {};
    const { pathMonitor } = options;

    const serve = serveStatic(options.servePath);

    const emitter = new EventEmitter();

    function checkAssetMatchesEtag(assetPath, etag) {
        const record = pathMonitor.getAsset(assetPath);
        if (record == null) return false;
        return `"${record.hash}"` === etag;
    }

    function middleware(req, res, next) {
        let assetPath = req.path;
        const assetPathParts = assetPath.split("/");
        assetPathParts.shift();

        if (assetPathParts[0] === "__node_modules") {
            if (assetPathParts.length === 1) {
                return res.status(404).send();
            }

            const [, moduleName, ...relativeParts] = assetPathParts;

            let fileContent;
            try {
                const mainPath = require.resolve(moduleName);
                const filePath =
                    relativeParts.length > 0
                        ? path.join(walkUpToModule(mainPath), ...relativeParts)
                        : mainPath;
                fileContent = fs.readFileSync(filePath, "utf8");
            } catch {
                return res.status(404).send();
            }

            res.setHeader("Content-Type", "application/javascript");
            res.setHeader("Etag", `"${generateHash(fileContent)}"`);

            if (req.stale) {
                return res.send(fileContent);
            } else {
                return res.sendStatus(304);
            }
        }

        // handle a root level index.html file
        if (
            assetPath === "/" &&
            isFile(path.join(options.servePath, "index.html"))
        ) {
            assetPath = "/index.html";
        }

        if (
            req.headers["if-none-match"] &&
            checkAssetMatchesEtag(assetPath, req.headers["if-none-match"])
        ) {
            return res.status(304).send();
        }

        if (/\.html$/.test(assetPath)) {
            pathMonitor.loadHtmlAssetAndPopulate(assetPath).then(record => {
                if (record === null) return res.status(404).send();

                const fileStream = new stream.Readable();
                fileStream.push(record.asset.text, "utf8");
                fileStream.push(null);

                res.setHeader("Content-Type", "text/html");
                res.setHeader("ETag", `"${record.hash}"`);

                watchStreamAndInjectClient(fileStream, res);
            });
        } else {
            emitter.emit("asset", assetPath);

            serve(req, res, next);
        }
    }

    return {
        middleware,
        emitter
    };
};
