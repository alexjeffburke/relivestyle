const crypto = require("crypto");
const EventEmitter = require("events");
const fsAsync = require("fs").promises;
const mime = require("mime");
const path = require("path");
const serveStatic = require("serve-static");
const stream = require("stream");

const assetPaths = require("./assetPaths");
const debug = require("./debug").extend("assetMiddleware");
const watchStreamAndInjectClient = require("./watchStreamAndInjectClient");

const INTERNAL_MODULES = ["relivestyle", "sockette"];

async function ensureFile(filePath) {
  const stat = await fsAsync.stat(filePath);
  if (!stat.isFile) throw new Error("invalid");
  return filePath;
}

function expandRelative(relativeCount) {
  const parts = [];
  while (relativeCount > 0) {
    parts.push("..");
    relativeCount -= 1;
  }
  return parts;
}

function generateHash(source) {
  return crypto
    .createHash("md5")
    .update(source, "utf8")
    .digest("hex");
}

function makeContentTypeForPath(filePath) {
  const extension = path.extname(filePath);
  let contentType = mime.getType(extension);
  if (contentType === "application/node") {
    // correct served content-type in the case of a ".cjs"
    contentType = "application/javascript";
  }
  return contentType;
}

async function readContentAndMaybeRewrite(maybeFilePath, resolver, reqPath) {
  try {
    const filePath = await ensureFile(maybeFilePath);

    const contentType = makeContentTypeForPath(filePath);
    debug(`__node_modules: content type "${contentType}" for asset ${reqPath}`);

    let content;
    if (contentType === "application/javascript") {
      const fileContent = await fsAsync.readFile(filePath, "utf8");
      debug(`__node_modules: rewriting JavaScript for asset ${reqPath}`);
      content = await rewriteSource(resolver, fileContent);
    } else {
      content = await fsAsync.readFile(filePath);
    }
    return {
      content,
      contentType
    };
  } catch {
    return {
      content: null,
      contentType: null
    };
  }
}

async function rewriteSource(resolver, source) {
  const output = await resolver.rewrite(source);
  if (output === "") return source;
  return output;
}

module.exports = function(options) {
  options = options || {};
  const { importResolver, pathMonitor, servePath, nodeModulesPath } = options;
  const permitClientSideRouting = !!options.permitClientSideRouting;

  const serve = serveStatic(options.servePath);

  const emitter = new EventEmitter();

  function checkAssetMatchesEtag(assetPath, etag) {
    const record = pathMonitor.getAsset(assetPath);
    if (record == null) return false;
    return `"${record.hash}"` === etag;
  }

  function toStaticPath(relativeParts) {
    let basePath;
    let isRelative;
    if (relativeParts[0] === "~") {
      isRelative = true;
      const [, relativeCount] = relativeParts.splice(0, 2);
      relativeParts = expandRelative(relativeCount).concat(relativeParts);
      basePath = servePath;
    } else {
      isRelative = false;
      basePath = nodeModulesPath;
    }
    const relativePath = path.join(...relativeParts);
    const staticPath = path.join(basePath, relativePath);

    return {
      isRelative,
      relativePath,
      staticPath
    };
  }

  function middleware(req, res, next) {
    const reqPath = req.path;
    const reqPathParts = reqPath.split("/");
    reqPathParts.shift();

    if (reqPathParts[0] === "__node_modules") {
      if (reqPathParts.length === 1) {
        return res.status(404).send();
      }

      const relativeParts = reqPathParts.slice(1);

      let mainPath;
      let resolver = importResolver;
      try {
        if (!INTERNAL_MODULES.includes(relativeParts[0])) throw new Error();
        mainPath = require.resolve(relativeParts.join("/"));
      } catch {}
      if (!mainPath) {
        const result = toStaticPath(relativeParts);
        mainPath = result.staticPath;
        if (result.isRelative) {
          const relativeDir = path.dirname(result.relativePath);
          resolver = importResolver.derive(relativeDir);
        }
      }

      const content = readContentAndMaybeRewrite(mainPath, resolver, reqPath);
      content.then(({ content, contentType }) => {
        if (content === null) return res.status(404).send();

        res.setHeader("Content-Type", contentType);
        res.setHeader("Etag", `"${generateHash(content)}"`);

        if (req.stale) {
          return res.send(content);
        } else {
          return res.status(304).send();
        }
      });
      return;
    }

    const assetPath = assetPaths.normalisePath(reqPath, servePath, {
      permitClientSideRouting
    });
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
