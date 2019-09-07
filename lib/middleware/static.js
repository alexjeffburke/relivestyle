const EventEmitter = require("events");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
const serveStatic = require("serve-static");

const socketteClientCode = fs.readFileSync(
    path.resolve(__dirname, "../frontend/sockette.js"),
    "utf-8"
);
const liveStyleClientCode = fs.readFileSync(
    path.resolve(__dirname, "../frontend/client.js"),
    "utf-8"
);
const liveStyleClientCodeMd5Hex = crypto
    .createHash("md5")
    .update(liveStyleClientCode, "utf-8")
    .digest("hex");

const watchStreamAndInjectClient = require("../watchStreamAndInjectClient");

module.exports = function(options) {
    options = options || {};

    const serve = serveStatic(options.servePath);

    const emitter = new EventEmitter();

    function middleware(req, res, next) {
        if (req.url === "/__livestyle/sockette.js") {
            res.set({ "Content-Type": "text/javascript" });
            return res.send(socketteClientCode);
        } else if (req.url === "/__livestyle/client.js") {
            res.set({
                "Content-Type": "text/javascript",
                ETag: '"' + liveStyleClientCodeMd5Hex + '"'
            });

            if (req.stale) {
                return res.send(liveStyleClientCode);
            } else {
                return res.sendStatus(304);
            }
        }

        if (/\.html$/.test(req.url)) {
            const fileStream = fs.createReadStream(
                path.join(options.servePath, req.url)
            );

            watchStreamAndInjectClient(fileStream, res);
        } else {
            emitter.emit("asset", req.url);

            serve(req, res, next);
        }
    }

    return {
        middleware,
        emitter
    };
};
