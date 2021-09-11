const expect = require("unexpected")
  .clone()
  .use(require("unexpected-snapshot"));
const fs = require("fs");
const normalizeUrl = require("normalizeurl");
const path = require("path");
const sinon = require("sinon");

const Client = require("../lib/Client");
const ImportResolver = require("../lib/ImportResolver");
const PathMonitor = require("../lib/PathMonitor");
const { determineNearestNodeModules } = require("../lib/tasteServePath");

const TEST_DATA = path.join(__dirname, "..", "testdata");

function toNodeModulesPath(servePath) {
  return determineNearestNodeModules(servePath).nodeModulesPath;
}

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

    it("should persist the loaded asset", async () => {
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

      return expect(instance.promiseByAssetPath[assetPath], "to be defined")
        .then(() => loadPromise)
        .then(() => {
          expect(instance.promiseByAssetPath[assetPath], "to be undefined");
        });
    });

    describe("with a previously loaded asset", () => {
      it("should return promises from subsequent calls", async () => {
        const servePath = path.join(TEST_DATA, "example-project");
        instance = new PathMonitor({ servePath });
        const assetPath = "/stuff.html";
        const record = await instance.loadAsset(assetPath);

        const maybePromise = instance.loadAsset(assetPath);

        expect(maybePromise, "to be a", "Promise");
        expect(await maybePromise, "to equal", record);
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

      it("should clear the dirty flag", async () => {
        const assetPath = "/stuff.css";
        const servePath = path.join(TEST_DATA, "example-relations");
        instance = new PathMonitor({ servePath });
        await instance.loadAssetOnly(assetPath);
        instance.loadedByAssetPath[assetPath].asset.text = "EEK";
        instance.loadedByAssetPath[assetPath].dirty = true;

        const record = await instance.loadAssetOnly(assetPath);

        expect(record.dirty, "to be false");
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

      const populatePromise = instance.loadHtmlAssetAndPopulate(assetPath);
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

    it('should work for modules within a directory containg an "@"', async () => {
      const servePath = path.join(TEST_DATA, "example-index@");
      instance = new PathMonitor({ servePath });
      const assetPath = "/index.html";

      const record = await instance.loadHtmlAssetAndPopulate(assetPath);

      expect(record, "not to be null");
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
            url: normalizeUrl(`file://${servePath}/stuff.js`)
          },
          {
            url: normalizeUrl(`file://${servePath}/otherstuff.js`)
          }
        ]);
      });
    });

    it("should rewrite inline script imports", async () => {
      const assetPath = "/index.html";
      const servePath = path.join(TEST_DATA, "example-image");
      const nodeModulesPath = toNodeModulesPath(servePath);
      const importResolver = new ImportResolver({ servePath, nodeModulesPath });
      instance = new PathMonitor({ importResolver, servePath });

      const { asset } = await instance.loadHtmlAssetAndPopulate(assetPath);

      expect(
        asset.text,
        "to equal snapshot",
        expect.unindent`
          <html><head></head><body>
                  <script type="module">import { lasercat } from '/__node_modules/catimages/index.js';
          const img = document.createElement('img');
          img.src = lasercat;
          document.body.appendChild(img);</script>
          ${"    "}

          </body></html>
        `
      );
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
    it("should rewrite node_modules imports with double quote", async () => {
      const assetPath = "/preact.js";
      const servePath = path.join(TEST_DATA, "example-npm");
      const nodeModulesPath = toNodeModulesPath(servePath);
      const importResolver = new ImportResolver({ servePath, nodeModulesPath });
      instance = new PathMonitor({ importResolver, servePath });

      const { asset } = await instance.loadJsAssetAndPopulate(assetPath);

      expect(
        asset.text,
        "to equal snapshot",
        expect.unindent`
          import { html, render } from "/__node_modules/htm/preact/index.module.js";

          render(
            html\`
              <h1>Hello World</h1>
            \`,
            document.getElementById("app-root")
          );

        `
      );
    });

    it("should rewrite node_modules imports with single quote", async () => {
      const assetPath = "/react-window.js";
      const servePath = path.join(TEST_DATA, "example-npm");
      const nodeModulesPath = toNodeModulesPath(servePath);
      const importResolver = new ImportResolver({ servePath, nodeModulesPath });
      instance = new PathMonitor({ importResolver, servePath });

      const { asset } = await instance.loadJsAssetAndPopulate(assetPath);

      expect(
        asset.text,
        "to equal snapshot",
        expect.unindent`
          // prettier-ignore
          // eslint-disable-next-line no-unused-vars
          import { VariableSizeGrid } from '/__node_modules/react-window/dist/index.esm.js';

        `
      );
    });

    it("should rewrite node_modules imports in a workspace", async () => {
      const assetPath = "/index.js";
      const servePath = path.join(TEST_DATA, "example-workspaces", "demo");
      const nodeModulesPath = toNodeModulesPath(servePath);
      const importResolver = new ImportResolver({
        isMonorepo: true,
        servePath,
        nodeModulesPath
      });
      instance = new PathMonitor({ importResolver, servePath });

      const { asset } = await instance.loadJsAssetAndPopulate(assetPath);

      expect(
        asset.text,
        "to equal snapshot",
        expect.unindent`
          // eslint-disable-next-line import/no-named-default
          import { default as hello } from "/__node_modules/~/1/packages/utils/index.js";

          console.log(hello);

        `
      );
    });

    it("should pass through relative imports", async () => {
      const assetPath = "/stuff.js";
      const servePath = path.join(TEST_DATA, "example-module");
      const nodeModulesPath = toNodeModulesPath(servePath);
      const diskPath = path.join(servePath, assetPath.slice(1));
      const importResolver = new ImportResolver({ servePath, nodeModulesPath });
      instance = new PathMonitor({ importResolver, servePath });

      const record = await instance.loadJsAssetAndPopulate(assetPath);

      expect(record.asset, "to satisfy", {
        text: fs.readFileSync(diskPath, "utf8")
      });
    });

    describe("with a dirtied asset", () => {
      it("should reload the asset", async () => {
        const assetPath = "/stuff.js";
        const servePath = path.join(TEST_DATA, "example-module");
        const nodeModulesPath = toNodeModulesPath(servePath);
        const importResolver = new ImportResolver({
          servePath,
          nodeModulesPath
        });
        instance = new PathMonitor({ importResolver, servePath });
        await instance.loadJsAssetAndPopulate(assetPath);
        instance.loadedByAssetPath[assetPath].asset.text = "EEK";
        instance.loadedByAssetPath[assetPath].dirty = true;

        await instance.loadJsAssetAndPopulate(assetPath);

        const { asset } = instance.loadedByAssetPath[assetPath];
        expect(asset.text, "not to contain", "EEK");
      });
    });

    describe("with an asset that has delicate code", () => {
      it("should use the raw text of the asset", async () => {
        const assetPath = "/example.js";
        const servePath = path.join(TEST_DATA, "example-delicate");
        const nodeModulesPath = toNodeModulesPath(servePath);
        const importResolver = new ImportResolver({
          servePath,
          nodeModulesPath
        });
        instance = new PathMonitor({ importResolver, servePath });
        await instance.loadJsAssetAndPopulate(assetPath);

        const { asset } = instance.loadedByAssetPath[assetPath];

        expect(
          asset.text,
          "to equal snapshot",
          expect.unindent`
          /* eslint-disable */
          // prettier-ignore
          const MyComponent = () => {
              return /*#__PURE__*/React.createElement(App, null);
          };

        `
        );
      });

      it("should use the raw text of the asset when rewriting", async () => {
        const assetPath = "/rewrite.js";
        const servePath = path.join(TEST_DATA, "example-delicate");
        const nodeModulesPath = toNodeModulesPath(servePath);
        const importResolver = new ImportResolver({
          servePath,
          nodeModulesPath
        });
        instance = new PathMonitor({ importResolver, servePath });
        await instance.loadJsAssetAndPopulate(assetPath);

        const { asset } = instance.loadedByAssetPath[assetPath];

        // eslint-disable-next-line no-unused-expressions
        asset.text; // simulate first access

        expect(
          asset.text,
          "to equal snapshot",
          expect.unindent`
          /* eslint-disable */
          import { html, render } from "/__node_modules/htm/preact/index.module.js";

          // prettier-ignore
          const MyComponent = () => {
              return /*#__PURE__*/React.createElement(App, null);
          };

        `
        );
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
        url: normalizeUrl(`file://${diskPath}`)
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

      expect(instance.clientAssets.get(client), "to equal", "/stuff.html");
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

    describe("when permitting client side routing", () => {
      it("should normalise a missing client path", async () => {
        const servePath = path.join(TEST_DATA, "example-index");
        instance = new PathMonitor({
          servePath,
          permitClientSideRouting: true
        });
        sinon.spy(instance, "_linkClientHandleOrphans");
        const leafPath = "/index.html";
        await instance.loadAsset(leafPath);
        const client = new Client({});

        client.clientState = "active";
        instance.linkClient(client, "/stuff");

        expect(instance.clientAssets.get(client), "to equal", "/index.html");
      });
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

      expect(instance.dirtyAsset.firstCall.args, "to satisfy", [assetPath]);
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

      await instance.notifyClientForFsPath(path.join(servePath, "other.js"));

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
      const nodeModulesPath = toNodeModulesPath(servePath);
      const importResolver = new ImportResolver({ servePath, nodeModulesPath });
      instance = new PathMonitor({ importResolver, servePath });

      const leafPath = "/stuff.html";
      await instance.loadAsset(leafPath);
      const assetPath = "/stuff.css";
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

      const cssAssets = instance.assetGraph.findAssets({
        type: "Css"
      });
      expect(cssAssets, "to be empty");
    });

    it("should notify a linked client", async () => {
      const servePath = path.join(TEST_DATA, "example-relations");
      instance = new PathMonitor({ servePath });

      const leafPath = "/stuff.html";
      await instance.loadAsset(leafPath);
      const assetPath = "/stuff.js";
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
      const nodeModulesPath = toNodeModulesPath(servePath);
      const importResolver = new ImportResolver({ servePath, nodeModulesPath });
      instance = new PathMonitor({ importResolver, servePath });
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
        const nodeModulesPath = toNodeModulesPath(servePath);
        const importResolver = new ImportResolver({
          servePath,
          nodeModulesPath
        });
        instance = new PathMonitor({
          importResolver,
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
