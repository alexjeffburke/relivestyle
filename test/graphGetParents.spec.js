const AssetGraph = require("assetgraph");
const expect = require("unexpected");
const path = require("path");

const graphGetParents = require("../lib/graphGetParents");

const EXAMPLES_DIR = path.join(__dirname, "..", "examples");

describe("graphGetParents", () => {
  it("should walk up to a parent", async () => {
    const graph = new AssetGraph({ root: EXAMPLES_DIR });
    const [htmlAsset] = await graph.loadAssets("/index.html");
    await graph.populate({
      from: htmlAsset,
      followRelations: {
        to: {
          type: { $in: ["JavaScript", "Css"] },
          crossorigin: false
        }
      }
    });

    const [scriptRelation] = await graph.findRelations({
      type: "HtmlScript"
    });

    expect(graphGetParents(scriptRelation.to, { type: "Html" }), "to equal", [
      htmlAsset
    ]);
  });

  describe("with multiple levels", () => {
    let htmlAsset;
    let scriptAsset;

    before(async () => {
      const graph = new AssetGraph({ root: EXAMPLES_DIR });

      htmlAsset = (await graph.loadAssets("/index.html"))[0];

      await graph.populate({
        from: htmlAsset,
        followRelations: {
          to: {
            type: { $in: ["JavaScript", "Css"] },
            crossorigin: false
          }
        }
      });
      await graph.populate({
        from: graph.findAssets({ type: "JavaScript" }),
        followRelations: {
          to: {
            type: { $in: ["JavaScript", "Css"] },
            crossorigin: false
          }
        }
      });

      scriptAsset = (
        await graph.findAssets({
          url: `file://${EXAMPLES_DIR}/nested.js`
        })
      )[0];
    });

    it("should walk up multiple levels to an asset", async () => {
      expect(graphGetParents(scriptAsset, { type: "Html" }), "to equal", [
        htmlAsset
      ]);
    });
  });
});
