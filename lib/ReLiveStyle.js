const AssetGraph = require("assetgraph");
const chokidar = require("chokidar");
const path = require("path");

const graphGetParents = require("./graphGetParents");

class ReLiveStyle {
    constructor(options) {
        options = options || {};

        this.watcher = null;
        this.servePath = options.servePath;
        this.clientAssets = new Map();
        this.assetGraph = new AssetGraph({
            root: this.servePath
        });
        this.loadedByAssetPath = {};
        this.promiseByAssetPath = {};

        this.watcher = chokidar.watch(this.servePath, {
            ignored: /(^|[/\\])\../,
            persistent: true
        });

        this.watcher
            .on("change", fsPath => this.notifyClientForFsPath(fsPath))
            .on("unlink", fsPath => this.notifyClientForFsPath(fsPath));
    }

    stopWatching() {
        this.watcher.close();
    }

    addClient(client, assetPath) {
        this.clientAssets.set(client, assetPath);

        this.loadAsset(assetPath);
    }

    removeClient(client) {
        this.clientAssets.delete(client);
    }

    loadAsset(assetPath) {
        if (this.loadedByAssetPath[assetPath]) {
            return;
        } else {
            this.loadedByAssetPath[assetPath] = true;
        }

        this.promiseByAssetPath[assetPath] = this.assetGraph
            .loadAssets(assetPath)
            .then(() => {
                delete this.promiseByAssetPath[assetPath];
            });
    }

    async notifyClientForFsPath(fsPath) {
        const assetPath = "/" + path.relative(this.servePath, fsPath);

        await Promise.all(Object.values(this.promiseByAssetPath));

        const url = `file://${this.servePath}${assetPath}`;
        const leafAssets = this.assetGraph.findAssets({ url });

        if (leafAssets.length !== 1) {
            return;
        }

        let resolvedAssetPath;
        const loadAsset = leafAssets[0];
        if (loadAsset.type !== "Html") {
            const parentAssets = graphGetParents(leafAssets[0]);
            if (parentAssets.length !== 1) {
                return;
            }
            const parentAsset = parentAssets[0];
            const filePath = parentAsset.url.replace("file://", "");
            resolvedAssetPath = "/" + path.relative(this.servePath, filePath);
        } else {
            resolvedAssetPath = assetPath;
        }

        for (const [client, clientAssetPath] of this.clientAssets.entries()) {
            if (clientAssetPath === resolvedAssetPath) {
                client.send("reload");
            }
        }
    }
}

module.exports = ReLiveStyle;
