const AssetGraph = require("assetgraph");
const chokidar = require("chokidar");
const crypto = require("crypto");
const normalizeUrl = require("normalizeurl");
const path = require("path");
const urltools = require("urltools");

const assetPaths = require("./assetPaths");
const debug = require("./debug").extend("PathMonitor");
const graphGetParents = require("./graphGetParents");

const defer = new Promise(resolve => setImmediate(() => resolve()));

class PathAsset {
  constructor(asset) {
    this.asset = asset;
    this.dirty = false;
  }

  get hash() {
    return PathAsset.assetToHash(this.asset);
  }

  get text() {
    return PathAsset.assetToText(this.asset);
  }

  static assetToHash(asset) {
    const text = PathAsset.assetToText(asset);
    return crypto
      .createHash("sha1")
      .update(text)
      .digest("hex");
  }

  static assetToText(asset) {
    if (asset.type !== "JavaScript") {
      return asset.text;
    } else if (typeof asset._text !== "undefined") {
      return asset._text;
    } else {
      asset._text = asset._getTextFromRawSrc();
    }
  }
}

class PathMonitor {
  constructor(options) {
    options = options || {};

    this.watcher = null;
    this.servePath = options.servePath;
    this.importResolver = options.importResolver;
    this.alwaysUpdateClients = !!options.alwaysUpdateClients;
    this.permitClientSideRouting = !!options.permitClientSideRouting;
    this.clientAssets = new Map();
    this.assetGraph = new AssetGraph({
      root: this.servePath
    });
    this.assetGraph.on("warn", () => {}); // suppress
    this.loadedByAssetPath = {};
    this.orphanByAssetPath = {};
    this.promiseByAssetPath = {};
  }

  makeAssetPathFromFsPath(fsPath) {
    return `/${path.relative(this.servePath, fsPath)}`;
  }

  makeGraphUrlFromAssetPath(assetPath) {
    return `file://${this.servePath}${assetPath}`;
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
        .on("unlink", fsPath => this.notifyClientForFsPathDelete(fsPath));

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
      client.setUnseenChanges({ ...this.orphanByAssetPath });
    }
  }

  informClients(leafAssetPaths, unlinkedAssetPath) {
    const clientsToInform = [];
    const unlinkedClients = [];

    for (const [client, clientAssetPath] of this.clientAssets.entries()) {
      if (leafAssetPaths.includes(clientAssetPath)) {
        clientsToInform.push(client);
      } else if (clientAssetPath === null) {
        unlinkedClients.push(client);
      }
    }

    for (const client of clientsToInform) {
      client.processEvent({
        type: "reload",
        args: { assetPath: this.clientAssets.get(client) }
      });
    }

    if (unlinkedAssetPath !== null) {
      for (const client of unlinkedClients) {
        client.addUnseenChange(unlinkedAssetPath);
      }
    }
  }

  linkClient(client, linkPath) {
    const assetPath = assetPaths.normalisePath(linkPath, this.servePath, {
      permitClientSideRouting: this.permitClientSideRouting
    });
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
    const clientAssetPath = this.clientAssets.get(client);
    let mustInformClient = false;

    for (const orphanAssetPath of orphans) {
      const leafAssetPaths = await this.resolveLeafForAssetPath(
        orphanAssetPath
      );
      if (leafAssetPaths === null) continue;
      if (leafAssetPaths.includes(clientAssetPath)) {
        // Past here both the asset and its parent
        // are now loaded: this means we can safely
        // remove it from the orphan list: either the
        // next client ends up in this codepath if it
        // happens to race, will find itself & reload
        // or there is enough information to find who
        // to inform when something has changed.
        delete this.orphanByAssetPath[orphanAssetPath];
        mustInformClient = true;
      }
    }

    if (mustInformClient) {
      // The client being added was one affected by
      // the orphaned asset so force it to reload.
      client.clearUnseenChanges();
      client.processEvent({
        type: "reload",
        args: { assetPath: clientAssetPath }
      });
    }
  }

  removeClient(client) {
    this.clientAssets.delete(client);
  }

  dirtyAsset(assetPath) {
    const result = this.getAsset(assetPath);
    if (result === null) return;
    result.dirty = true;
  }

  deleteAsset(assetPath) {
    const record = this.getAsset(assetPath);
    if (record === null) return;
    this.assetGraph.removeAsset(record.asset);
    delete this.loadedByAssetPath[assetPath];
  }

  getAsset(assetPath) {
    const result = this.loadedByAssetPath[assetPath];
    if (!result || result.dirty) return null;
    return result;
  }

  loadAsset(assetPath) {
    if (this.promiseByAssetPath[assetPath]) {
      return this.promiseByAssetPath[assetPath];
    } else if (
      this.loadedByAssetPath[assetPath] &&
      !this.loadedByAssetPath[assetPath].dirty
    ) {
      return Promise.resolve(this.loadedByAssetPath[assetPath]);
    }

    const relevance = assetPaths.determineRelevance(assetPath);

    if (relevance === "html") {
      return this.loadHtmlAssetAndPopulate(assetPath);
    } else if (relevance === "js") {
      return this.loadJsAssetAndPopulate(assetPath);
    } else {
      return this.loadAssetOnly(assetPath);
    }
  }

  async _loadAsset(assetPath, assetFn) {
    try {
      const record =
        this.loadedByAssetPath[assetPath] ||
        new PathAsset((await this.assetGraph.loadAssets(assetPath))[0]);
      // protect call to load a valid-looking path that does not succeed
      if (!record.asset.isLoaded) {
        throw new Error("incorrect asset");
      }
      if (record.dirty) {
        await record.asset.unload();
        await record.asset.load();
      }
      if (typeof assetFn === "function") {
        await assetFn(record);
      }
      record.dirty = false;
      this.loadedByAssetPath[assetPath] = record;
      return record;
    } catch {
      delete this.loadedByAssetPath[assetPath];
      return null;
    } finally {
      delete this.promiseByAssetPath[assetPath];
    }
  }

  loadAssetOnly(assetPath) {
    const promise = this._loadAsset(assetPath, defer);
    this.promiseByAssetPath[assetPath] = promise;
    return this.promiseByAssetPath[assetPath];
  }

  loadHtmlAssetAndPopulate(assetPath) {
    const promise = this._loadAsset(assetPath, async pathAsset => {
      const { asset } = pathAsset;

      try {
        await this.assetGraph.populate({
          from: asset,
          followRelations: {
            to: {
              type: { $in: ["JavaScript", "Css"] }
            }
          }
        });

        for (const outgoingRelation of asset.outgoingRelations) {
          if (outgoingRelation instanceof AssetGraph.HtmlScript) {
            const { to: referencedAsset } = outgoingRelation;
            debug(
              `#loadHtmlAssetAndPopulate(): rewriting inline script for asset ${assetPath}`
            );
            const rewrittenText = await this.importResolver.rewrite(
              PathAsset.assetToText(referencedAsset)
            );
            if (rewrittenText !== "") {
              referencedAsset.text = rewrittenText;
            }
          }
        }
      } catch {
        // ignore these errors so they are visible in the UI
      }
    });
    this.promiseByAssetPath[assetPath] = promise;
    return this.promiseByAssetPath[assetPath];
  }

  loadJsAssetAndPopulate(assetPath) {
    const promise = this._loadAsset(assetPath, async pathAsset => {
      const { asset } = pathAsset;
      debug(
        `#loadJsAssetAndPopulate(): rewriting JavaScript for asset ${assetPath}`
      );
      const rewrittenText = await this.importResolver.rewrite(pathAsset.text);
      if (rewrittenText !== "") {
        asset.text = rewrittenText;
      }
    });
    this.promiseByAssetPath[assetPath] = promise;
    return this.promiseByAssetPath[assetPath];
  }

  async notifyAllClients() {
    for (const [client] of this.clientAssets.entries()) {
      client.processEvent({ type: "reload", args: { assetPath: null } });
    }
  }

  async notifyClientForFsPath(fsPath) {
    const assetPath = this.makeAssetPathFromFsPath(fsPath);
    const leafAssetPaths = await this.resolveLeafForAssetPath(assetPath);

    this.dirtyAsset(assetPath);

    if (this.alwaysUpdateClients) {
      return this.notifyAllClients();
    } else if (leafAssetPaths !== null) {
      this.informClients(leafAssetPaths, assetPath);
    }
  }

  async notifyClientForFsPathDelete(fsPath) {
    const assetPath = this.makeAssetPathFromFsPath(fsPath);
    const leafAssetPaths = await this.resolveLeafForAssetPath(assetPath);

    this.deleteAsset(assetPath);

    if (this.alwaysUpdateClients) {
      return this.notifyAllClients();
    } else if (leafAssetPaths !== null) {
      this.informClients(leafAssetPaths, null);
    }
  }

  async resolveLeafForAssetPath(assetPath) {
    await Promise.all(Object.values(this.promiseByAssetPath));

    const url = this.makeGraphUrlFromAssetPath(assetPath);
    const [loadAsset = null] = this.assetGraph.findAssets({
      url: normalizeUrl(url)
    });

    if (loadAsset === null) {
      // The asset for which we received a change notification
      // was never previously loaded. This means that the parent
      // page containing it has not been served yet -> we add it
      // to the list of orphans such that, at the point a client
      // arrives (perhaps there was a hold up receiving the msg
      // informing us of their base url), we can check if it is
      // affected by changes to this asset and if so ensure we
      // immediately send it a "reload".
      this.orphanByAssetPath[assetPath] = true;
      return null;
    }

    let leafAssetPaths;
    if (loadAsset.type !== "Html") {
      const parentAssets = graphGetParents(loadAsset, {
        type: "Html"
      });
      if (parentAssets.length === 0) {
        this.orphanByAssetPath[assetPath] = true;
        return null;
      }
      leafAssetPaths = parentAssets.map(asset => {
        const fsPath = urltools.fileUrlToFsPath(asset.url);
        return this.makeAssetPathFromFsPath(fsPath);
      });
    } else {
      leafAssetPaths = [assetPath];
    }

    return leafAssetPaths;
  }
}

module.exports = PathMonitor;
