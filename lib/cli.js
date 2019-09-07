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
            console.log(`Listening on: ${server.address().port}`);
        });

        process.on("SIGINT", () => {
            server.close(() => resolve());
        });
    });
};
