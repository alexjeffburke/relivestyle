class Client {
    constructor(options) {
        options = options || {};

        this.pathMonitor = options.pathMonitor;
        this.clientState = "created";
        this.onReload = options.onReload;
        this.unseenChangesByAssetPath = {};
    }

    addUnseenChange(assetPath) {
        this.unseenChangesByAssetPath[assetPath] = true;
    }

    clearUnseenChanges() {
        this.unseenChangesByAssetPath = {};
    }

    getUnseenChanges() {
        return this.unseenChangesByAssetPath;
    }

    setUnseenChanges(unseenChangesByAssetPath) {
        this.unseenChangesByAssetPath = unseenChangesByAssetPath;
    }

    processEvent(msg) {
        switch (msg.type) {
            case "open":
                this.clientState = "ready";
                this.pathMonitor.addClient(this);
                break;
            case "register":
                this.clientState = "active";
                this.pathMonitor.linkClient(this, msg.args.pathname);
                break;
            case "reload":
                this.processReload(msg.args.assetPath);
                break;
            case "close":
                this.clientState = "dead";
                this.pathMonitor.removeClient(this);
                break;
        }
    }

    processReload(assetPath) {
        if (this.clientState === "active") {
            this.onReload();
        }
    }
}

module.exports = Client;
