const expect = require("unexpected")
  .clone()
  .use(require("unexpected-snapshot"));
const path = require("path");

const ImportResolver = require("../lib/ImportResolver");
const { determineNearestNodeModules } = require("../lib/tasteServePath");

const ROOT_DIR = path.join(__dirname, "..");
const EXAMPLE_LERNA_DEMO_DIR = path.join(
  ROOT_DIR,
  "testdata",
  "example-lerna",
  "demo"
);
const EXAMPLE_LERNA_PACKAGE_INTERNALS = path.join(
  EXAMPLE_LERNA_DEMO_DIR,
  "..",
  "packages",
  "internals"
);
const EXAMPLE_WORKSPACES_DEMO_DIR = path.join(
  ROOT_DIR,
  "testdata",
  "example-workspaces",
  "demo"
);

function toNodeModulesPath(servePath) {
  return determineNearestNodeModules(servePath).nodeModulesPath;
}

describe("ImportResolver", () => {
  let rewriter;

  beforeEach(() => {
    rewriter = new ImportResolver({
      servePath: ROOT_DIR,
      nodeModulesPath: toNodeModulesPath(ROOT_DIR)
    });
  });

  it("should throw on a missing serve path", async () => {
    expect(
      () => {
        new ImportResolver();
      },
      "to throw",
      "ImportResolver: missing serve path"
    );
  });

  it("should throw on a missing node_modules path", async () => {
    expect(
      () => {
        new ImportResolver({ servePath: ROOT_DIR });
      },
      "to throw",
      "ImportResolver: missing node modules path"
    );
  });

  it("should rewrite node_modules imports with double quote", async () => {
    const input = 'import bits from "htm/preact";';

    const output = await rewriter.rewrite(input);

    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            import bits from "/__node_modules/htm/preact/index.module.js";
            `
    );
  });

  it("should rewrite node_modules imports with single quote", async () => {
    const input = "import { FixedSizeGrid } from 'react-window';";

    const output = await rewriter.rewrite(input);

    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            import { FixedSizeGrid } from '/__node_modules/react-window/dist/index.esm.js';
            `
    );
  });

  it("should rewrite multiple node_modules imports", async () => {
    const input =
      'import bits from "htm/preact";\nimport bits from "unexpected";';

    const output = await rewriter.rewrite(input);

    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            import bits from "/__node_modules/htm/preact/index.module.js";
            import bits from "/__node_modules/unexpected/build/lib/index.js";
            `
    );
  });

  it("should rewrite namespaced node_modules imports", async () => {
    const input = 'import bits from "@depository/store";';

    const output = await rewriter.rewrite(input);

    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            import bits from "/__node_modules/@depository/store/src/index.js";
            `
    );
  });

  it("should pass through relative imports", async () => {
    const input = `import otherstuff from "./otherstuff.js";\nimport bits from "htm/preact";`;

    const output = await rewriter.rewrite(input);

    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            import otherstuff from "./otherstuff.js";
            import bits from "/__node_modules/htm/preact/index.module.js";
            `
    );
  });

  it("should ignore absolute url imports", async () => {
    const input =
      'import bits from "htm/preact";\nimport standalone from "https://unpkg.com/htm/preact/standalone.module.js";';

    const output = await rewriter.rewrite(input);

    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            import bits from "/__node_modules/htm/preact/index.module.js";
            import standalone from "https://unpkg.com/htm/preact/standalone.module.js";
            `
    );
  });

  it("should return the empty string with no rewrites", async () => {
    const input = `import otherstuff from "./otherstuff.js";`;

    const output = await rewriter.rewrite(input);

    expect(output, "to equal", "");
  });

  it("should reject if the module could not be resolved (missing monorepo flag)", async () => {
    const input = "import bits from '@namespace/internals'";
    const brokenModulePath = path.join(
      EXAMPLE_LERNA_DEMO_DIR,
      "../packages/internals/index.js"
    );

    const rewriter = new ImportResolver({
      servePath: EXAMPLE_LERNA_DEMO_DIR,
      nodeModulesPath: toNodeModulesPath(EXAMPLE_LERNA_DEMO_DIR)
    });

    await expect(
      () => rewriter.rewrite(input),
      "to be rejected with",
      `invalid module path "${brokenModulePath}"`
    );
  });

  describe("when hoisted", () => {
    it("should rewrite namespaced node_modules imports", async () => {
      const input = "import bits from '@nano-router/router';";

      const rewriter = new ImportResolver({
        servePath: EXAMPLE_LERNA_DEMO_DIR,
        nodeModulesPath: toNodeModulesPath(EXAMPLE_LERNA_DEMO_DIR)
      });
      const output = await rewriter.rewrite(input);

      expect(
        output,
        "to equal snapshot",
        expect.unindent`
              import bits from '/__node_modules/~/3/node_modules/@nano-router/router/src/index.js';
              `
      );
    });
  });

  describe("within a monorepo", () => {
    it("should rewrite namespaced monorepo node_modules imports", async () => {
      const input = 'import bits from "@namespace/utils";';

      const output = await new ImportResolver({
        servePath: EXAMPLE_WORKSPACES_DEMO_DIR,
        nodeModulesPath: toNodeModulesPath(EXAMPLE_WORKSPACES_DEMO_DIR),
        isMonorepo: true
      }).rewrite(input);

      expect(
        output,
        "to equal snapshot",
        expect.unindent`
              import bits from "/__node_modules/~/1/packages/utils/index.js";
              `
      );
    });

    it("should rewrite namespaced monorepo node_modules nested imports", async () => {
      const input = 'import { hello } from "@namespace/utils";';

      const output = await new ImportResolver({
        rootDir: EXAMPLE_LERNA_DEMO_DIR,
        servePath: EXAMPLE_LERNA_PACKAGE_INTERNALS,
        nodeModulesPath: toNodeModulesPath(EXAMPLE_LERNA_PACKAGE_INTERNALS),
        isMonorepo: true
      }).rewrite(input);

      expect(
        output,
        "to equal snapshot",
        expect.unindent`
              import { hello } from "/__node_modules/~/1/packages/utils/lib/index.js";
              `
      );
    });

    it("should rewrite hoisted node_modules imports", async () => {
      const input = 'import bits from "htm/preact";';

      const output = await new ImportResolver({
        servePath: EXAMPLE_WORKSPACES_DEMO_DIR,
        nodeModulesPath: toNodeModulesPath(EXAMPLE_WORKSPACES_DEMO_DIR),
        isMonorepo: true
      }).rewrite(input);

      expect(
        output,
        "to equal snapshot",
        expect.unindent`
              import bits from "/__node_modules/~/3/node_modules/htm/preact/index.module.js";
              `
      );
    });

    it("should rewrite hoisted namespaced node_modules imports", async () => {
      const input = 'import bits from "@nano-router/router";';

      const output = await new ImportResolver({
        servePath: EXAMPLE_WORKSPACES_DEMO_DIR,
        nodeModulesPath: toNodeModulesPath(EXAMPLE_WORKSPACES_DEMO_DIR),
        isMonorepo: true
      }).rewrite(input);

      expect(
        output,
        "to equal snapshot",
        expect.unindent`
              import bits from "/__node_modules/~/3/node_modules/@nano-router/router/src/index.js";
              `
      );
    });
  });
});
