const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const Server = require("../lib/Server");

const TEST_DATA = path.join(__dirname, "..", "testdata");
const TIMEOUT_FOR_MESSAGE = 1950; // just under mocha default

function runBlockInServer(server, blockFn) {
    const closeServer = () => new Promise(resolve => server.close(resolve));

    return new Promise(resolve => {
        server.listen(0, resolve);
    })
        .then(() => blockFn(server.address()))
        .then(() => closeServer())
        .catch(e =>
            closeServer().then(() => {
                throw e;
            })
        );
}

describe("Server", () => {
    it("should allow a websocket connection", () => {
        const servePath = path.join(TEST_DATA, "example-project");

        const server = new Server({ servePath });

        return runBlockInServer(server, address => {
            return new Promise((resolve, reject) => {
                const ws = new WebSocket(
                    `ws://localhost:${address.port}/__livestyle`
                );
                ws.on("error", e => {
                    reject(e);
                });
                ws.on("open", () => {
                    resolve();
                });
            });
        });
    });

    describe("when a file changes", () => {
        const servePath = path.join(TEST_DATA, "example-project");
        const filePath = path.join(servePath, "stuff.html");
        let fileContent;

        beforeEach(() => {
            fileContent = fs.readFileSync(filePath, "utf8");
        });

        afterEach(() => {
            fs.writeFileSync(filePath, fileContent, "utf8");
        });

        it('should send a "reload" message to the client', () => {
            const server = new Server({ servePath });
            let resolveReady;
            const openPromise = new Promise(
                resolve => (resolveReady = resolve)
            );

            // Simulate a HTTP GET for a file.
            server.watcher.watch("/stuff.html");

            return runBlockInServer(server, address => {
                const client = new Promise((resolve, reject) => {
                    const ws = new WebSocket(
                        `ws://localhost:${address.port}/__livestyle`
                    );
                    const timeout = setTimeout(() => {
                        reject(new Error("message not received"));
                    }, TIMEOUT_FOR_MESSAGE);

                    ws.on("open", () => {
                        resolveReady();
                    });

                    ws.on("error", e => {
                        clearTimeout(timeout);
                        reject(e);
                    });

                    ws.on("message", msg => {
                        if (msg === "reload") {
                            clearTimeout(timeout);
                            resolve();
                        } else {
                            reject(new Error("message was incorrect"));
                        }
                    });
                });

                return openPromise.then(() => {
                    fs.writeFileSync(
                        filePath,
                        fileContent.replace("Hello", "Hello!"),
                        "utf8"
                    );

                    return client;
                });
            });
        });
    });
});
