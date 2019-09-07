const express = require("express");
const http = require("http");
const WebSocketServer = require("ws").Server;

const ReLiveStyle = require("./ReLiveStyle");
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

                switch (msg.type) {
                    case "register":
                        instance.addClient(connection, msg.args.pathname);
                }
            });

            connection.on("close", function() {
                instance.removeClient(connection);
            });
        });
    }

    address() {
        return this.server.listening ? this.server.address() : null;
    }

    close(...args) {
        this.wsServer.close(() => {
            this.server.close(...args);
        });
    }

    listen(...args) {
        this.server.listen(...args);

        return this;
    }
}

module.exports = Server;
