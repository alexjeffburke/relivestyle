const fs = require("fs");
const path = require("path");

const ImportResolver = require("./ImportResolver");
const PathMonitor = require("./PathMonitor");
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

  const importResolver = new ImportResolver({ servePath });
  const pathMonitor = new PathMonitor({
    importResolver,
    servePath,
    alwaysUpdateClients: args.always
  });
  const server = new Server({ importResolver, pathMonitor, servePath });

  return new Promise(resolve => {
    const onListen = () => {
      const { address, port, family } = server.address();
      const hostname =
        family === "IPv6" && address === "::" ? "0.0.0.0" : address;
      console.log(`Listening on: http://${hostname}:${port}`);
    };
    const listenArgs = [onListen];
    if (args.port) {
      listenArgs.unshift(args.port);
    }

    server.listen(...listenArgs);

    process.on("SIGINT", () => {
      server.close(() => resolve());
    });
  });
};
