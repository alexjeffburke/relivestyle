const express = require("express");
const http = require("http");
const WebSocketServer = require("ws").Server;

const Client = require("./Client");
const createMiddleware = require("./assetMiddleware");

class Server {
    constructor(options) {
        options = options || {};

        this.pathMonitor = null;
        this.server = null;
        this.wsServer = null;

        const { pathMonitor, servePath } = options;

        this.pathMonitor = pathMonitor;
        this.server = http.createServer();
        this.wsServer = new WebSocketServer({
            server: this.server,
            path: "/__livestyle"
        });

        const { middleware } = createMiddleware({
            pathMonitor,
            servePath
        });

        const app = express();
        app.use(middleware);
        this.server.on("request", app);

        this.wsServer.on("connection", connection => {
            const client = new Client({
                pathMonitor: this.pathMonitor,
                onReload: () => connection.send("reload")
            });

            client.processEvent({ type: "open" });

            connection.on("message", function(data) {
                let msg;
                try {
                    msg = JSON.parse(data);
                    if (typeof msg.type !== "string") {
                        throw new Error("invalid");
                    }
                } catch (e) {
                    return;
                }

                // handle a root level index.html file
                if (msg.type === "register" && msg.args.pathname === "/") {
                    msg.args.pathname = "/index.html";
                }

                client.processEvent(msg);
            });

            connection.on("close", function() {
                client.processEvent({ type: "close" });
            });
        });
    }

    address() {
        return this.server.listening ? this.server.address() : null;
    }

    close(...args) {
        this.pathMonitor.stopWatching();
        this.wsServer.close(() => {
            this.server.close(...args);
        });
    }

    listen(...args) {
        this.pathMonitor.startWatching().then(() => {
            this.server.listen(...args);
        });

        return this;
    }
}

module.exports = Server;
