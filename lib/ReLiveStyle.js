const chokidar = require("chokidar");
const path = require("path");

class ReLiveStyle {
    constructor(options) {
        options = options || {};

        this.servePath = options.servePath;
        this.clientAssets = new Map();

        const watcher = chokidar.watch(this.servePath, {
            ignored: /(^|[/\\])\../,
            persistent: true
        });

        watcher
            .on("change", fsPath => this.notifyClientForFsPath(fsPath))
            .on("unlink", fsPath => this.notifyClientForFsPath(fsPath));
    }

    addClient(client, assetPath) {
        this.clientAssets.set(client, assetPath);
    }

    removeClient(client) {
        this.clientAssets.delete(client);
    }

    notifyClientForFsPath(fsPath) {
        const assetPath = "/" + path.relative(this.servePath, fsPath);

        for (const [client, clientAssetPath] of this.clientAssets.entries()) {
            if (clientAssetPath === assetPath) {
                client.send("reload");
            }
        }
    }
}

module.exports = ReLiveStyle;
