const fs = require("fs");
const path = require("path");

const Server = require("./Server");

module.exports = function(cwd, args) {
    const servePath = path.resolve(cwd, args.directory);

    try {
        const servePathStat = fs.statSync(servePath);
        if (!servePathStat.isDirectory) {
            throw new Error("not a directory");
        }
    } catch (e) {
        throw new Error("supplied path was not a directory");
    }

    const server = new Server({ servePath });

    return new Promise(resolve => {
        server.listen(() => {
            const { address, port, family } = server.address();
            const hostname =
                family === "IPv6" && address === "::" ? "0.0.0.0" : address;
            console.log(`Listening on: http://${hostname}:${port}`);
        });

        process.on("SIGINT", () => {
            server.close(() => resolve());
        });
    });
};
