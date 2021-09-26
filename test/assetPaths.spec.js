const expect = require("unexpected");
const path = require("path");

const assetPaths = require("../lib/assetPaths");

const TEST_DATA = path.join(__dirname, "..", "testdata");
const TEST_DATA_EXAMPLE_BADINDEX = path.join(TEST_DATA, "example-badindex");
const TEST_DATA_EXAMPLE_INDEX = path.join(TEST_DATA, "example-index");
const TEST_DATA_EXAMPLE_RELATIONS = path.join(TEST_DATA, "example-relations");

describe("assetPaths", () => {
  describe("determineRelevance", () => {
    it("should determine .html", async () => {
      const assetPath = "/path/to/file.html";

      const relevance = assetPaths.determineRelevance(assetPath);

      expect(relevance, "to equal", "html");
    });

    it("should determine .htm", async () => {
      const assetPath = "/path/to/file.htm";

      const relevance = assetPaths.determineRelevance(assetPath);

      expect(relevance, "to equal", "html");
    });

    it("should determine .js", async () => {
      const assetPath = "/path/to/file.js";

      const relevance = assetPaths.determineRelevance(assetPath);

      expect(relevance, "to equal", "js");
    });

    it("should determine .mjs", async () => {
      const assetPath = "/path/to/file.mjs";

      const relevance = assetPaths.determineRelevance(assetPath);

      expect(relevance, "to equal", "js");
    });

    it("should determine .cjs", async () => {
      const assetPath = "/path/to/file.cjs";

      const relevance = assetPaths.determineRelevance(assetPath);

      expect(relevance, "to equal", "js");
    });

    it("should determine .css", async () => {
      const assetPath = "/path/to/file.css";

      const relevance = assetPaths.determineRelevance(assetPath);

      expect(relevance, "to equal", "css");
    });

    it("should determine when irrelevant", async () => {
      const assetPath = "/path/to/file.txt";

      const relevance = assetPaths.determineRelevance(assetPath);

      expect(relevance, "to equal", "none");
    });
  });

  describe("normalisePath", () => {
    it("should add an html suffix with a matching file on-disk", async () => {
      const inputPath = "/stuff";

      const assetPath = assetPaths.normalisePath(
        inputPath,
        TEST_DATA_EXAMPLE_RELATIONS
      );

      expect(assetPath, "to equal", "/stuff.html");
    });

    it("should return index.html without a matching file on-disk", async () => {
      const inputPath = "/stuff";

      const assetPath = assetPaths.normalisePath(
        inputPath,
        TEST_DATA_EXAMPLE_INDEX
      );

      expect(assetPath, "to equal", "/stuff");
    });

    describe("when index.html is a directory", () => {
      it("should not return index.html when requesting /", async () => {
        const inputPath = "/";

        const assetPath = assetPaths.normalisePath(
          inputPath,
          TEST_DATA_EXAMPLE_BADINDEX
        );

        expect(assetPath, "to equal", "/");
      });

      it("should return adding html suffix for a file inside the directory", async () => {
        const inputPath = "/index.html/stuff";

        const assetPath = assetPaths.normalisePath(
          inputPath,
          TEST_DATA_EXAMPLE_BADINDEX
        );

        expect(assetPath, "to equal", "/index.html/stuff.html");
      });
    });

    describe("with client side routing flag", () => {
      it("should return index.html with no matching file on-disk", async () => {
        const inputPath = "/stuff";

        const assetPath = assetPaths.normalisePath(
          inputPath,
          TEST_DATA_EXAMPLE_INDEX,
          { permitClientSideRouting: true }
        );

        expect(assetPath, "to equal", "/index.html");
      });

      it("should not return index.html with a matching file on-disk", async () => {
        const inputPath = "/stuff";

        const assetPath = assetPaths.normalisePath(
          inputPath,
          TEST_DATA_EXAMPLE_RELATIONS,
          { permitClientSideRouting: true }
        );

        expect(assetPath, "not to equal", "/index.html");
      });
    });
  });
});
