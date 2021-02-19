const expect = require("unexpected");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { tasteServePath } = require("../lib/tasteServePath");

const TEST_DATA = path.join(__dirname, "..", "testdata");
const TEST_DATA_EXAMPLE_LERNA = path.join(TEST_DATA, "example-lerna");
const TEST_DATA_EXAMPLE_LERNA_DEMO_DIR = path.join(
  TEST_DATA_EXAMPLE_LERNA,
  "demo"
);
const TEST_DATA_EXAMPLE_WORKSPACES = path.join(TEST_DATA, "example-workspaces");
const TEST_DATA_EXAMPLE_WORKSPACES_DEMO_DIR = path.join(
  TEST_DATA_EXAMPLE_WORKSPACES,
  "demo"
);

describe("tasteServePath", () => {
  it("should throw if a node_modules folder cannot be located", () => {
    const servePath = fs.realpathSync(os.tmpdir());

    expect(
      () => {
        tasteServePath(servePath);
      },
      "to throw",
      "unable to determine nearest node_modules"
    );
  });

  describe("lerna", () => {
    it("should return true at the top-level", () => {
      const { isMonorepo } = tasteServePath(TEST_DATA_EXAMPLE_LERNA);

      expect(isMonorepo, "to be true");
    });

    it("should return true for a nested package", () => {
      const { isMonorepo } = tasteServePath(TEST_DATA_EXAMPLE_LERNA_DEMO_DIR);

      expect(isMonorepo, "to be true");
    });
  });

  describe("workspaces", () => {
    it("should return true at the top-level", () => {
      const { isMonorepo } = tasteServePath(TEST_DATA_EXAMPLE_WORKSPACES);

      expect(isMonorepo, "to be true");
    });

    it("should return true for a nested package", () => {
      const { isMonorepo } = tasteServePath(
        TEST_DATA_EXAMPLE_WORKSPACES_DEMO_DIR
      );

      expect(isMonorepo, "to be true");
    });
  });
});
