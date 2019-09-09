const express = require("express");
const http = require("http");
const WebSocketServer = require("ws").Server;

const ReLiveStyle = require("./ReLiveStyle");
const Client = require("./Client");
const staticMiddleware = require("./middleware/static");

class Server {
    constructor(options) {
        options = options || {};

        this.reLiveStyle = null;
        this.server = null;
        this.wsServer = null;

        const { servePath } = options;

        const instance = (this.reLiveStyle = new ReLiveStyle({ servePath }));
        const server = (this.server = http.createServer());
        const wsServer = (this.wsServer = new WebSocketServer({
            server: server,
            path: "/__livestyle"
        }));

        const { middleware, emitter } = staticMiddleware({ servePath });

        emitter.on("asset", assetPath => instance.loadAsset(assetPath));

        const app = express();
        app.use(middleware);
        server.on("request", app);

        wsServer.on("connection", function(connection) {
            const client = new Client({
                reLiveStyle: instance,
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
        this.reLiveStyle.stopWatching();
        this.wsServer.close(() => {
            this.server.close(...args);
        });
    }

    listen(...args) {
        this.reLiveStyle.startWatching().then(() => {
            this.server.listen(...args);
        });

        return this;
    }
}

module.exports = Server;
