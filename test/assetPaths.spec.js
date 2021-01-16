const expect = require("unexpected");

const assetPaths = require("../lib/assetPaths");

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
});
