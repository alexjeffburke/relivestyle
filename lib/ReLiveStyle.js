const AssetGraph = require("assetgraph");
const chokidar = require("chokidar");
const path = require("path");

const graphGetParents = require("./graphGetParents");

class ReLiveStyle {
    constructor(options) {
        options = options || {};

        this.watcher = null;
        this.servePath = options.servePath;
        this.alwaysUpdateClients = !!options.alwaysUpdateClients;
        this.clientAssets = new Map();
        this.assetGraph = new AssetGraph({
            root: this.servePath
        });
        this.loadedByAssetPath = {};
        this.orphanByAssetPath = {};
        this.promiseByAssetPath = {};
    }

    makeAssetPathFromFsPath(fsPath) {
        return "/" + path.relative(this.servePath, fsPath);
    }

    startWatching() {
        if (this.watcher !== null) {
            return;
        }

        return new Promise(resolve => {
            const watcher = chokidar.watch(this.servePath, {
                ignored: /(^|[/\\])\../,
                persistent: true
            });

            watcher
                .on("ready", () => resolve())
                .on("change", fsPath => this.notifyClientForFsPath(fsPath))
                .on("unlink", fsPath => this.notifyClientForFsPath(fsPath));

            this.watcher = watcher;
        });
    }

    stopWatching() {
        if (this.watcher === null) {
            return;
        }

        this.watcher.close();
        this.watcher = null;
    }

    addClient(client) {
        this.clientAssets.set(client, null);

        if (Object.keys(this.orphanByAssetPath).length > 0) {
            client.setUnseenChanges(this.orphanByAssetPath);
        }
    }

    linkClient(client, assetPath) {
        this.clientAssets.set(client, assetPath);

        this.loadHtmlAssetAndPopulate(assetPath);

        const orphans = Object.keys(client.getUnseenChanges());
        if (orphans.length > 0) {
            // Loading of the HTML asset and all its related
            // assets has been scheduled by this point. That
            // means client resolution will block against the
            // completion of that operation so it is safe for
            // it to be triggered.
            this._linkClientHandleOrphans(client, orphans);
        }
    }

    async _linkClientHandleOrphans(client, orphans) {
        let mustInformClient = false;

        for (const assetPath of orphans) {
            const clientsToInform = await this.resolveClientsForAssetPath(
                assetPath
            );

            const foundRecord = clientsToInform.find(r => r[0] === client);
            if (foundRecord) {
                const [, assetPath] = foundRecord;
                // Past here both the asset and its parent
                // are now loaded: this means we can safely
                // remove it from the orphan list: either the
                // next client ends up in this codepath if it
                // happens to race, will find itself & reload
                // or there is enough information to find who
                // to inform when something has changed.
                delete this.orphanByAssetPath[assetPath];
                mustInformClient = true;
            }
        }

        if (mustInformClient) {
            // The client being added was one affected by
            // the orphaned asset so force it to reload.
            client.clearUnseenChanges();
            client.processEvent({ type: "reload", args: { assetPath: null } });
        }
    }

    removeClient(client) {
        this.clientAssets.delete(client);
    }

    loadAsset(assetPath, assetFn) {
        if (this.loadedByAssetPath[assetPath]) {
            return Promise.resolve();
        } else {
            this.loadedByAssetPath[assetPath] = true;
        }

        this.promiseByAssetPath[assetPath] = this.assetGraph
            .loadAssets(assetPath)
            .then(async assets => {
                const fromAsset = assets[0];
                if (typeof assetFn === "function") {
                    await assetFn(fromAsset);
                }
                delete this.promiseByAssetPath[assetPath];
                return fromAsset;
            })
            .catch(() => {
                delete this.promiseByAssetPath[assetPath];
            });

        return this.promiseByAssetPath[assetPath];
    }

    loadHtmlAssetAndPopulate(assetPath) {
        return this.loadAsset(assetPath, fromAsset =>
            this.assetGraph.populate({
                from: { url: `file://${this.servePath}${assetPath}` },
                followRelations: {
                    to: {
                        type: { $in: ["JavaScript", "Css"] }
                    }
                }
            })
        );
    }

    async notifyAllClients() {
        for (const [client] of this.clientAssets.entries()) {
            client.processEvent({ type: "reload", args: { assetPath: null } });
        }
    }

    async notifyClientForFsPath(fsPath) {
        if (this.alwaysUpdateClients) {
            return this.notifyAllClients();
        }

        const assetPath = this.makeAssetPathFromFsPath(fsPath);

        const clientsToInform = await this.resolveClientsForAssetPath(
            assetPath
        );

        for (const [client, assetPath] of clientsToInform) {
            client.processEvent({ type: "reload", args: { assetPath } });
        }
    }

    async resolveClientsForAssetPath(assetPath) {
        await Promise.all(Object.values(this.promiseByAssetPath));

        const url = `file://${this.servePath}${assetPath}`;
        const leafAssets = this.assetGraph.findAssets({ url });

        if (leafAssets.length !== 1) {
            // The asset for which we received a change notification
            // was never previously loaded. This means that the parent
            // page containing it has not been served yet -> we add it
            // to the list of orphans such that, at the point a client
            // arrives (perhaps there was a hold up receiving the msg
            // informing us of their base url), we can check if it is
            // affected by changes to this asset and if so ensure we
            // immediately send it a "reload".
            this.orphanByAssetPath[assetPath] = true;
            return [];
        }

        let resolvedAssetPath;
        let overrideInformAssetPath;
        const loadAsset = leafAssets[0];
        if (loadAsset.type !== "Html") {
            const parentAssets = graphGetParents(leafAssets[0]);
            if (parentAssets.length === 0) {
                // perform operation on clients that are not fully registered
                resolvedAssetPath = null;
                // ensure the full asset path is recorded as an unseen change
                overrideInformAssetPath = assetPath;
            } else if (parentAssets.length === 1) {
                const fsPath = parentAssets[0].url.replace("file://", "");
                resolvedAssetPath = this.makeAssetPathFromFsPath(fsPath);
            } else {
                return [];
            }
        } else {
            resolvedAssetPath = assetPath;
        }

        const clientsToInform = [];
        for (const [client, clientAssetPath] of this.clientAssets.entries()) {
            if (clientAssetPath === resolvedAssetPath) {
                clientsToInform.push([
                    client,
                    overrideInformAssetPath || clientAssetPath
                ]);
            }
        }
        return clientsToInform;
    }
}

module.exports = ReLiveStyle;
