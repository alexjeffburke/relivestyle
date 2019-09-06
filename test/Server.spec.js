const path = require("path");
const WebSocket = require("ws");

const Server = require("../lib/Server");

const TEST_DATA = path.join(__dirname, "testdata");

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
});
