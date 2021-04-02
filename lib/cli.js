const path = require("path");

const ImportResolver = require("./ImportResolver");
const PathMonitor = require("./PathMonitor");
const Server = require("./Server");
const { tasteServePath } = require("./tasteServePath");

module.exports = function(cwd, args) {
  const { servePath, nodeModulesPath, isMonorepo } = tasteServePath(
    path.resolve(cwd, args.directory)
  );

  const importResolver = new ImportResolver({
    isMonorepo,
    servePath,
    nodeModulesPath
  });
  const pathMonitor = new PathMonitor({
    importResolver,
    servePath,
    alwaysUpdateClients: args.always,
    permitClientSideRouting: args.single
  });
  const server = new Server({
    importResolver,
    pathMonitor,
    servePath,
    nodeModulesPath,
    enableCors: args.cors,
    permitClientSideRouting: args.single
  });

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
