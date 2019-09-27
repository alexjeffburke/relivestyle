const express = require("express");
const http = require("http");
const WebSocketServer = require("ws").Server;

const Watcher = require("./Watcher");
const staticMiddleware = require("./middleware/static");

class Server {
    constructor(options) {
        options = options || {};

        this.server = null;
        this.wsServer = null;

        const { servePath } = options;

        this.watcher = new Watcher({ servePath });
        const server = (this.server = http.createServer());
        const wsServer = (this.wsServer = new WebSocketServer({
            server: server,
            path: "/__livestyle"
        }));

        const { middleware, emitter } = staticMiddleware({ servePath });

        emitter.on("asset", assetPath => this.watcher.watch(assetPath));

        const app = express();
        app.use(middleware);
        server.on("request", app);

        wsServer.on("connection", connection => {
            const onReload = () => connection.send("reload");
            this.watcher.on("change", onReload);

            connection.on("close", () => {
                this.watcher.removeListener("change", onReload);
            });
        });
    }

    address() {
        return this.server.listening ? this.server.address() : null;
    }

    close(...args) {
        this.watcher.stopWatching();
        this.wsServer.close(() => {
            this.server.close(...args);
        });
    }

    listen(...args) {
        this.watcher.startWatching().then(() => {
            this.server.listen(...args);
        });

        return this;
    }
}

module.exports = Server;
