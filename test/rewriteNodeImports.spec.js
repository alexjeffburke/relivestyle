const expect = require("unexpected")
  .clone()
  .use(require("unexpected-snapshot"));
const path = require("path");

const rewriteNodeImports = require("../lib/rewriteNodeImports");

const ROOT_DIR = path.join(__dirname, "..");

describe("rewriteNodeImports", () => {
  it("should rewrite node_modules imports with single quote", async () => {
    const input = "import bits from 'htm/preact';";

    const output = await rewriteNodeImports(input, ROOT_DIR);

    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            import bits from '/__node_modules/htm/preact/index.module.js';
            `
    );
  });

  it("should rewrite node_modules imports with double quote", async () => {
    const input = 'import bits from "htm/preact";';

    const output = await rewriteNodeImports(input, ROOT_DIR);

    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            import bits from "/__node_modules/htm/preact/index.module.js";
            `
    );
  });

  it("should rewrite multiple node_modules imports", async () => {
    const input =
      'import bits from "htm/preact";\nimport bits from "htm/preact";';

    const output = await rewriteNodeImports(input, ROOT_DIR);

    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            import bits from "/__node_modules/htm/preact/index.module.js";
            import bits from "/__node_modules/htm/preact/index.module.js";
            `
    );
  });

  it("should rewrite namespaced node_modules imports", async () => {
    const input = 'import bits from "@depository/store";';

    const output = await rewriteNodeImports(input, ROOT_DIR);

    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            import bits from "/__node_modules/@depository/store/src/index.js";
            `
    );
  });

  it("should ignore absolute url imports", async () => {
    const input =
      'import bits from "htm/preact";\nimport standalone from "https://unpkg.com/htm/preact/standalone.module.js";';

    const output = await rewriteNodeImports(input, ROOT_DIR);

    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            import bits from "/__node_modules/htm/preact/index.module.js";
            import standalone from "https://unpkg.com/htm/preact/standalone.module.js";
            `
    );
  });
});
