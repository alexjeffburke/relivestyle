const expect = require("unexpected")
    .clone()
    .use(require("unexpected-snapshot"));
const fs = require("fs");
const path = require("path");
const sinon = require("sinon");

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
        it("should load assets (html)", async () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });
            sinon.spy(instance, "loadHtmlAssetAndPopulate");
            const assetPath = "/stuff.html";

            const loadPromise = instance.loadAsset(assetPath);

            await expect(loadPromise, "to be fulfilled");
            expect(instance.loadHtmlAssetAndPopulate.calledOnce, "to be true");
        });

        it("should load assets (javascript)", async () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });
            sinon.spy(instance, "loadJsAssetAndPopulate");
            const assetPath = "/stuff.js";

            const loadPromise = instance.loadAsset(assetPath);

            await expect(loadPromise, "to be fulfilled");
            expect(instance.loadJsAssetAndPopulate.calledOnce, "to be true");
        });

        it("should persist the previously loaded asset", async () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";

            const asset = await instance.loadAsset(assetPath);
            expect(instance.loadedByAssetPath[assetPath], "to be", asset);
        });

        it("should deduplicate load requests", async () => {
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

        it("should load any dirtied asset requests", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });
            sinon.spy(instance, "loadAssetOnly");
            const assetPath = "/stuff.css";
            instance.loadedByAssetPath[assetPath] = {
                asset: (await instance.assetGraph.loadAssets(assetPath))[0],
                dirty: true
            };

            const record = await instance.loadAsset(assetPath);

            expect(instance.loadAssetOnly.calledOnce, "to be true");
            // check the cache record was not re-created
            expect(instance.loadedByAssetPath[assetPath], "to be", record);
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

    describe("#loadAssetOnly", () => {
        it("should load assets", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });
            const assetPath = "/stuff.css";

            await instance.loadHtmlAssetAndPopulate(assetPath);
            expect(instance.assetGraph._assets.size, "to equal", 1);
        });

        it("should register the promise while it is loading", () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });
            const assetPath = "/stuff.css";

            const loadPromise = instance.loadAssetOnly(assetPath);

            return expect(
                instance.promiseByAssetPath[assetPath],
                "to equal",
                loadPromise
            ).then(() => loadPromise);
        });

        describe("with a dirtied asset", () => {
            it("should reload the asset", async () => {
                const assetPath = "/stuff.css";
                const servePath = path.join(TEST_DATA, "example-relations");
                instance = new PathMonitor({ servePath });
                await instance.loadAssetOnly(assetPath);
                instance.loadedByAssetPath[assetPath].asset.text = "EEK";
                instance.loadedByAssetPath[assetPath].dirty = true;

                await instance.loadAssetOnly(assetPath);

                const { asset } = instance.loadedByAssetPath[assetPath];
                expect(asset.text, "not to contain", "EEK");
            });
        });
    });

    describe("#loadHtmlAssetAndPopulate", () => {
        it("should populate assets", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";

            await instance.loadHtmlAssetAndPopulate(assetPath);

            expect(instance.assetGraph._assets.size, "to be greater than", 1);
        });

        it("should register the promise while it is populating", async () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";

            const loadPromise = instance.loadHtmlAssetAndPopulate(assetPath);

            return expect(
                instance.promiseByAssetPath[assetPath],
                "to equal",
                loadPromise
            ).then(() => loadPromise);
        });

        it("should deduplicate populate requests", async () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";

            const populatePromise = instance.loadHtmlAssetAndPopulate(
                assetPath
            );
            const secondPopulatePromise = instance.loadHtmlAssetAndPopulate(
                assetPath
            );

            try {
                expect(secondPopulatePromise, "to equal", populatePromise);
            } finally {
                await populatePromise;
            }
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

        it("should ignore population failures", async () => {
            const assetPath = "/stuff.html";
            const servePath = path.join(TEST_DATA, "example-badmodule");
            instance = new PathMonitor({ servePath });

            const record = await instance.loadHtmlAssetAndPopulate(assetPath);

            expect(record, "not to be null");
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

        it("should ignore node resolution that returns a non-HTML asset", async () => {
            const assetPath = "/stuff.html";
            const servePath = path.join(TEST_DATA, "example-badresolve");
            instance = new PathMonitor({ servePath });

            const record = await instance.loadHtmlAssetAndPopulate(assetPath);

            expect(record, "to be null");
        });

        describe("with a dirtied asset", () => {
            it("should reload the asset", async () => {
                const assetPath = "/stuff.html";
                const servePath = path.join(TEST_DATA, "example-module");
                instance = new PathMonitor({ servePath });
                await instance.loadHtmlAssetAndPopulate(assetPath);
                instance.loadedByAssetPath[assetPath].asset.text = "EEK";
                instance.loadedByAssetPath[assetPath].dirty = true;

                await instance.loadHtmlAssetAndPopulate(assetPath);

                const { asset } = instance.loadedByAssetPath[assetPath];
                expect(asset.text, "not to contain", "EEK");
            });
        });
    });

    describe("#loadJsAssetAndPopulate", () => {
        it("should rewrite node_modules imports", async () => {
            const assetPath = "/stuff.js";
            const servePath = path.join(TEST_DATA, "example-npm");
            instance = new PathMonitor({ servePath });

            const record = await instance.loadJsAssetAndPopulate(assetPath);

            expect(record.asset, "to satisfy", {
                text: expect.it(value =>
                    expect(
                        value,
                        "to equal snapshot",
                        expect.unindent`
                        import {
                            html,
                            render
                        } from '/__node_modules/htm/preact/index.module.js';
                        render(html\`
                                <h1>Hello World</h1>
                            \`, document.getElementById('app-root'));
                    `
                    )
                )
            });
        });

        it("should pass through relative imports", async () => {
            const assetPath = "/stuff.js";
            const servePath = path.join(TEST_DATA, "example-module");
            const diskPath = path.join(servePath, assetPath.slice(1));
            instance = new PathMonitor({ servePath });

            const record = await instance.loadJsAssetAndPopulate(assetPath);

            expect(record.asset, "to satisfy", {
                text: fs.readFileSync(diskPath, "utf8")
            });
        });

        describe("with a dirtied asset", () => {
            it("should reload the asset", async () => {
                const assetPath = "/stuff.js";
                const servePath = path.join(TEST_DATA, "example-module");
                instance = new PathMonitor({ servePath });
                await instance.loadJsAssetAndPopulate(assetPath);
                instance.loadedByAssetPath[assetPath].asset.text = "EEK";
                instance.loadedByAssetPath[assetPath].dirty = true;

                await instance.loadJsAssetAndPopulate(assetPath);

                const { asset } = instance.loadedByAssetPath[assetPath];
                expect(asset.text, "not to contain", "EEK");
            });
        });
    });

    describe("#getAsset", () => {
        it("should return a loaded asset", async () => {
            const assetPath = "/stuff.html";
            const servePath = path.join(TEST_DATA, "example-project");
            const diskPath = path.join(servePath, assetPath.slice(1));
            instance = new PathMonitor({ servePath });
            await instance.loadAsset(assetPath);
            const [asset] = instance.assetGraph.findAssets({
                url: `file://${diskPath}`
            });

            const record = instance.getAsset(assetPath);

            expect(record, "to satisfy", {
                asset: expect.it("to be", asset),
                dirty: false
            });
        });

        it("should return a dirtied asset", async () => {
            const assetPath = "/stuff.html";
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });
            await instance.loadAsset(assetPath);
            instance.loadedByAssetPath[assetPath].dirty = true;

            const record = instance.getAsset(assetPath);

            expect(record, "to be null");
        });
    });

    describe("#dirtyAsset", () => {
        it("should mark a loaded asset dirty", async () => {
            const assetPath = "/stuff.html";
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });
            await instance.loadAsset(assetPath);

            instance.dirtyAsset(assetPath);

            const record = instance.loadedByAssetPath[assetPath];
            expect(record, "to satisfy", {
                dirty: true
            });
        });
    });

    describe("#addClient", () => {
        it("should mark a client with any unseen changes", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });
            const assetPath = "/stuff.js";
            instance.orphanByAssetPath[assetPath] = true;
            const client = new Client({
                onReload: () => {
                    throw new Error("should not occur");
                }
            });

            instance.addClient(client);

            expect(
                client.unseenChangesByAssetPath,
                "to equal",
                instance.orphanByAssetPath
            ).and("not to be", instance.orphanByAssetPath);
        });
    });

    describe("#linkClient", () => {
        it("should normalise any recorded client path", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });
            sinon.spy(instance, "_linkClientHandleOrphans");
            const leafPath = "/stuff.html";
            await instance.loadAsset(leafPath);
            const assetPath = "/stuff.js";
            await instance.loadAsset(assetPath);
            const client = new Client({});

            client.clientState = "active";
            instance.linkClient(client, "/stuff");

            expect(
                instance.clientAssets.get(client),
                "to equal",
                "/stuff.html"
            );
        });

        it("should notify the client of an unseen changes", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });
            sinon.spy(instance, "_linkClientHandleOrphans");
            const leafPath = "/stuff.html";
            await instance.loadAsset(leafPath);
            const assetPath = "/stuff.js";
            await instance.loadAsset(assetPath);
            let onReloadCalled = false;
            const client = new Client({
                onReload: () => {
                    onReloadCalled = true;
                }
            });
            client.unseenChangesByAssetPath[assetPath] = true;

            client.clientState = "active";
            instance.linkClient(client, leafPath);

            await instance._linkClientHandleOrphans.firstCall.returnValue;

            expect(onReloadCalled, "to be true");
        });

        it("should clear any unseen changes", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });
            sinon.spy(instance, "_linkClientHandleOrphans");
            const leafPath = "/stuff.html";
            await instance.loadAsset(leafPath);
            const assetPath = "/stuff.js";
            await instance.loadAsset(assetPath);
            const client = new Client({
                onReload: () => {}
            });
            client.unseenChangesByAssetPath[assetPath] = true;

            client.clientState = "active";
            instance.linkClient(client, leafPath);

            await instance._linkClientHandleOrphans.firstCall.returnValue;

            expect(client.unseenChangesByAssetPath, "to equal", {});
        });
    });

    describe("#notifyClientForFsPath", () => {
        it("should notify a client for a corresponding leaf asset", async () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new PathMonitor({ servePath });

            const assetPath = "/stuff.html";
            await instance.loadAsset(assetPath);
            let onReloadCalled = false;
            const client = new Client({
                onReload: () => {
                    onReloadCalled = true;
                }
            });
            client.clientState = "active";
            instance.linkClient(client, assetPath);

            await instance.notifyClientForFsPath(
                path.join(servePath, assetPath.slice(1))
            );

            expect(onReloadCalled, "to be true");
        });

        it("should notify a client for a corresponding related asset", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });

            const leafPath = "/stuff.html";
            await instance.loadAsset(leafPath);
            const assetPath = "/stuff.js";
            await instance.loadAsset(assetPath);
            let onReloadCalled = false;
            const client = new Client({
                pathMonitor: instance,
                onReload: () => {
                    onReloadCalled = true;
                }
            });
            instance.addClient(client);
            client.clientState = "active";
            instance.linkClient(client, leafPath);

            await instance.notifyClientForFsPath(
                path.join(servePath, assetPath.slice(1))
            );

            expect(onReloadCalled, "to be true");
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

        it("should record an unseen change if the asset was never loaded", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });
            const assetPath = "/stuff.js";

            await instance.notifyClientForFsPath(
                path.join(servePath, assetPath.slice(1))
            );

            expect(instance.orphanByAssetPath, "to equal", {
                [assetPath]: true
            });
        });

        it("should record an unseen change if the asset was loaded", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });
            const assetPath = "/stuff.js";
            await instance.loadAsset(assetPath);

            await instance.notifyClientForFsPath(
                path.join(servePath, assetPath.slice(1))
            );

            expect(instance.orphanByAssetPath, "to equal", {
                [assetPath]: true
            });
        });

        it("should record any changes on an unlinked client", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });
            const leafAsset = "/stuff.html";
            await instance.loadAsset(leafAsset);
            const assetPath = "/stuff.js";
            await instance.loadAsset(assetPath);
            const client = new Client({
                onReload: () => {
                    throw new Error("should not occur");
                }
            });
            instance.addClient(client);

            await instance.notifyClientForFsPath(
                path.join(servePath, assetPath.slice(1))
            );

            expect(client.unseenChangesByAssetPath, "to equal", {
                [assetPath]: true
            });
        });

        it("should mark the asset dirtied", async () => {
            const assetPath = "/stuff.js";
            const servePath = path.join(TEST_DATA, "example-relations");
            const diskPath = path.join(servePath, assetPath.slice(1));
            instance = new PathMonitor({ servePath });
            sinon.stub(instance, "dirtyAsset");
            await instance.loadAsset(assetPath);

            await instance.notifyClientForFsPath(diskPath);

            expect(instance.dirtyAsset.firstCall.args, "to satisfy", [
                assetPath
            ]);
        });

        it("should ignore an orphaned related asset", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });
            sinon.spy(instance, "informClients");
            const leafPath = "/stuff.html";
            await instance.loadAsset(leafPath);
            await instance.loadAsset("/stuff.js");
            await instance.loadAsset("/other.js");

            const client = new Client({
                pathMonitor: instance,
                onReload: () => {
                    throw new Error("should not occur");
                }
            });
            instance.addClient(client);
            client.clientState = "active";
            instance.linkClient(client, leafPath);

            await instance.notifyClientForFsPath(
                path.join(servePath, "other.js")
            );

            expect(instance.informClients.getCalls(), "to be empty");
        });

        describe("with leafs pointing at related asset", () => {
            it("should notify any corresponding client", async () => {
                const servePath = path.join(TEST_DATA, "example-relations");
                instance = new PathMonitor({ servePath });

                const assetPath = "/stuff.js";
                await instance.loadAsset(assetPath);
                let client1Reloaded = false;
                const client1 = new Client({
                    pathMonitor: instance,
                    onReload: () => {
                        client1Reloaded = true;
                    }
                });
                const leaf1Path = "/stuff.html";
                await instance.loadAsset(leaf1Path);
                instance.addClient(client1);
                client1.clientState = "active";
                instance.linkClient(client1, leaf1Path);
                let client2Reloaded = false;
                const client2 = new Client({
                    pathMonitor: instance,
                    onReload: () => {
                        client2Reloaded = true;
                    }
                });
                const leaf2Path = "/ztuff.html";
                await instance.loadAsset(leaf2Path);
                instance.addClient(client2);
                client2.clientState = "active";
                instance.linkClient(client2, leaf2Path);

                await instance.notifyClientForFsPath(
                    path.join(servePath, assetPath.slice(1))
                );

                expect(client1Reloaded, "to be true");
                expect(client2Reloaded, "to be true");
            });
        });
    });

    describe("#notifyClientForFsPathDelete", () => {
        it("should remove the asset", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });

            const leafPath = "/stuff.html";
            await instance.loadAsset(leafPath);
            const assetPath = "/stuff.js";
            await instance.loadAsset(assetPath);
            const client = new Client({
                pathMonitor: instance,
                onReload: () => {}
            });
            instance.addClient(client);
            client.clientState = "active";
            instance.linkClient(client, leafPath);

            await instance.notifyClientForFsPathDelete(
                path.join(servePath, assetPath.slice(1))
            );

            const jsAssets = instance.assetGraph.findAssets({
                type: "JavaScript"
            });
            expect(jsAssets, "to be empty");
        });

        it("should notify a linked client", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });

            const leafPath = "/stuff.html";
            await instance.loadAsset(leafPath);
            const assetPath = "/stuff.js";
            await instance.loadAsset(assetPath);
            let onReloadCalled = false;
            const client = new Client({
                pathMonitor: instance,
                onReload: () => {
                    onReloadCalled = true;
                }
            });
            instance.addClient(client);
            client.clientState = "active";
            instance.linkClient(client, leafPath);

            await instance.notifyClientForFsPathDelete(
                path.join(servePath, assetPath.slice(1))
            );

            expect(onReloadCalled, "to be true");
        });

        it("should ignore an orphaned related asset", async () => {
            const servePath = path.join(TEST_DATA, "example-relations");
            instance = new PathMonitor({ servePath });
            sinon.spy(instance, "informClients");
            const leafPath = "/stuff.html";
            await instance.loadAsset(leafPath);
            await instance.loadAsset("/stuff.js");
            await instance.loadAsset("/other.js");

            const client = new Client({
                pathMonitor: instance,
                onReload: () => {
                    throw new Error("should not occur");
                }
            });
            instance.addClient(client);
            client.clientState = "active";
            instance.linkClient(client, leafPath);

            await instance.notifyClientForFsPathDelete(
                path.join(servePath, "other.js")
            );

            expect(instance.informClients.getCalls(), "to be empty");
        });

        describe("when alwaysUpdateClients", () => {
            it("should send reload messages to every client", async () => {
                const servePath = path.join(TEST_DATA, "example-relations");
                instance = new PathMonitor({
                    servePath,
                    alwaysUpdateClients: true
                });

                const leafPath = "/stuff.html";
                await instance.loadAsset(leafPath);
                await instance.loadAsset("/stuff.js");
                await instance.loadAsset("/other.html");
                await instance.loadAsset("/other.js");

                let onReloadCalled = false;
                const client = new Client({
                    pathMonitor: instance,
                    onReload: () => {
                        onReloadCalled = true;
                    }
                });
                instance.addClient(client);
                client.clientState = "active";
                instance.linkClient(client, leafPath);

                await instance.notifyClientForFsPathDelete(
                    path.join(servePath, "other.js")
                );

                expect(onReloadCalled, "to be true");
            });

            it("should remove the asset", async () => {
                const servePath = path.join(TEST_DATA, "example-relations");
                instance = new PathMonitor({ servePath });
                sinon.spy(instance, "deleteAsset");
                const leafPath = "/stuff.html";
                await instance.loadAsset(leafPath);
                const assetPath = "/stuff.js";
                await instance.loadAsset(assetPath);
                const client = new Client({
                    pathMonitor: instance,
                    onReload: () => {}
                });
                instance.addClient(client);
                client.clientState = "active";
                instance.linkClient(client, leafPath);

                await instance.notifyClientForFsPathDelete(
                    path.join(servePath, assetPath.slice(1))
                );

                expect(instance.deleteAsset.calledOnce, "to be true");
            });
        });
    });
});
