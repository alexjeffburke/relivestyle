const expect = require("unexpected");
const path = require("path");

const PathMonitor = require("../lib/PathMonitor");
const Client = require("../lib/Client");

const TEST_DATA = path.join(__dirname, "..", "testdata");

const waitImmediate = () => new Promise(resolve => setImmediate(resolve));

describe("PathMonitor", () => {
    let instance;

    afterEach(() => {
        instance.stopWatching();
    });

    describe("#loadAsset", () => {
        it("should load assets", () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";

            return expect(
                () => instance.loadAsset(assetPath),
                "to be fulfilled"
            );
        });

        it("should persist the previously loaded asset", async () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";

            const asset = await instance.loadAsset(assetPath);
            expect(instance.loadedByAssetPath[assetPath], "to be", asset);
        });

        it("should register the promise while it is loading assets", () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";
            const loadPromise = instance.loadAsset(assetPath);

            return expect(
                instance.promiseByAssetPath[assetPath],
                "to equal",
                loadPromise
            ).then(() => loadPromise);
        });

        it("should immediately record the asset as loading", async () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";
            const loadPromise = instance.loadAsset(assetPath);

            const secondLoadPromise = instance.loadAsset(assetPath);

            try {
                expect(secondLoadPromise, "to equal", loadPromise);
            } finally {
                await loadPromise;
            }
        });

        it("should not load the asset if it is already loaded", () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";
            instance.loadedByAssetPath[assetPath] = true;
            const loadPromise = instance.loadAsset(assetPath);

            return expect(
                instance.promiseByAssetPath[assetPath],
                "to be undefined"
            ).then(() => loadPromise);
        });

        it("should ignore any assets if that do not exist", () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.ico";
            const loadPromise = instance.loadAsset(assetPath);

            return expect(
                instance.promiseByAssetPath[assetPath],
                "to be defined"
            )
                .then(() => loadPromise)
                .then(() => {
                    expect(
                        instance.promiseByAssetPath[assetPath],
                        "to be undefined"
                    );
                });
        });
    });

    describe("#loadHtmlAssetAndPopulate", () => {
        it("should populate assets", () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";

            return expect(
                () => instance.loadHtmlAssetAndPopulate(assetPath),
                "to be fulfilled"
            ).then(() => {
                expect(
                    instance.assetGraph._assets.size,
                    "to be greater than",
                    1
                );
            });
        });

        it("should include type JavaScript", () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";

            return expect(
                () => instance.loadHtmlAssetAndPopulate(assetPath),
                "to be fulfilled"
            ).then(() => {
                expect(
                    instance.assetGraph.findAssets({ type: "JavaScript" }),
                    "not to be empty"
                );
            });
        });

        it("should include type Css", () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";

            return expect(
                () => instance.loadHtmlAssetAndPopulate(assetPath),
                "to be fulfilled"
            ).then(() => {
                expect(
                    instance.assetGraph.findAssets({ type: "Css" }),
                    "not to be empty"
                );
            });
        });

        it("should work for script of type module", () => {
            const servePath = path.join(TEST_DATA, "example-module");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";

            return expect(
                () => instance.loadHtmlAssetAndPopulate(assetPath),
                "to be fulfilled"
            ).then(() => {
                expect(
                    instance.assetGraph.findAssets({ type: "JavaScript" }),
                    "not to be empty"
                );
            });
        });

        it("should work for nested scripts", () => {
            const servePath = path.join(TEST_DATA, "example-module");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";

            return expect(
                () => instance.loadHtmlAssetAndPopulate(assetPath),
                "to be fulfilled"
            ).then(() => {
                const assets = instance.assetGraph.findAssets({
                    type: "JavaScript"
                });
                expect(assets, "to satisfy", [
                    {
                        url: `file://${servePath}/stuff.js`
                    },
                    {
                        url: `file://${servePath}/otherstuff.js`
                    }
                ]);
            });
        });
    });

    describe("#notifyClientForFsPath", () => {
        it("should notify a client for a corresponding asset path", async () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";
            await instance.loadAsset(assetPath);
            let onReloadCalled = false;
            const fakeClient = new Client({
                onReload: () => {
                    onReloadCalled = true;
                }
            });
            fakeClient.clientState = "active";
            instance.linkClient(fakeClient, assetPath);

            return expect(
                () =>
                    instance.notifyClientForFsPath(
                        path.join(servePath, assetPath.slice(1))
                    ),
                "to be fulfilled"
            ).then(() => {
                expect(onReloadCalled, "to be true");
            });
        });

        it("should wait for the resolution of any load promises", async () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";
            await instance.loadAsset(assetPath);
            // arrange for an outstanging load promise
            let resolvePromise;
            instance.promiseByAssetPath[assetPath] = new Promise(resolve => {
                resolvePromise = resolve;
            });
            // enable checking whether it resolved
            let sawResolution = false;
            instance
                .notifyClientForFsPath(path.join(servePath, assetPath.slice(1)))
                .then(() => (sawResolution = true));

            await waitImmediate();

            expect(sawResolution, "to be false");

            // now complete the pending load promise
            resolvePromise();

            await waitImmediate();

            expect(sawResolution, "to be true");
        });

        it("should notify the client of an unseen change if it is not yet active", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.js";
            await instance.loadAsset(assetPath);
            let onReloadCalled = false;
            const fakeClient = new Client({
                onReload: () => {
                    onReloadCalled = true;
                }
            });
            instance.addClient(fakeClient);

            return expect(
                () =>
                    instance.notifyClientForFsPath(
                        path.join(servePath, assetPath.slice(1))
                    ),
                "to be fulfilled"
            ).then(() => {
                expect(fakeClient.unseenChangesByAssetPath, "to equal", {
                    [assetPath]: true
                });
                expect(onReloadCalled, "to be false");
            });
        });
    });
});