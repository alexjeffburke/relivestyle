const expect = require("unexpected");
const path = require("path");

const ReLiveStyle = require("../lib/ReLiveStyle");

const TEST_DATA = path.join(__dirname, "..", "testdata");

const waitImmediate = () => new Promise(resolve => setImmediate(resolve));

describe("ReLiveStyle", () => {
    let instance;

    afterEach(() => {
        instance.stopWatching();
    });

    describe("#loadAsset", () => {
        it("should load assets", () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new ReLiveStyle({ servePath });

            const assetPath = "/stuff.html";

            return expect(
                () => instance.loadAsset(assetPath),
                "to be fulfilled"
            ).then(() => {
                expect(instance.loadedByAssetPath[assetPath], "to be true");
            });
        });

        it("should register the promise while it is loading assets", () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new ReLiveStyle({ servePath });

            const assetPath = "/stuff.html";
            const loadPromise = instance.loadAsset(assetPath);

            return expect(
                instance.promiseByAssetPath[assetPath],
                "to equal",
                loadPromise
            ).then(() => loadPromise);
        });

        it("should immediately mark the asset as loading", () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new ReLiveStyle({ servePath });

            const assetPath = "/stuff.html";
            const loadPromise = instance.loadAsset(assetPath);

            return expect(
                instance.loadedByAssetPath[assetPath],
                "to be true"
            ).then(() => loadPromise);
        });

        it("should not load the asset if it is already loaded", () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new ReLiveStyle({ servePath });

            const assetPath = "/stuff.html";
            instance.loadedByAssetPath[assetPath] = true;
            const loadPromise = instance.loadAsset(assetPath);

            return expect(
                instance.promiseByAssetPath[assetPath],
                "to be undefined"
            ).then(() => loadPromise);
        });
    });

    describe("#notifyClientForFsPath", () => {
        it("should notify a client for a corresponding asset path", async () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new ReLiveStyle({ servePath });

            const assetPath = "/stuff.html";
            await instance.loadAsset(assetPath);
            let sendArgs;
            const fakeClient = {
                send: (...args) => {
                    sendArgs = args;
                }
            };
            instance.addClient(fakeClient, assetPath);

            return expect(
                () =>
                    instance.notifyClientForFsPath(
                        path.join(servePath, assetPath.slice(1))
                    ),
                "to be fulfilled"
            ).then(() => {
                expect(sendArgs, "to equal", ["reload"]);
            });
        });

        it("should wait for the resolution of any load promises", async () => {
            const servePath = path.join(TEST_DATA, "example-project");
            instance = new ReLiveStyle({ servePath });

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
    });
});
