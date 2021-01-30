const expect = require("unexpected")
  .clone()
  .use(require("unexpected-express"))
  .use(require("unexpected-snapshot"));
const fs = require("fs");
const os = require("os");
const path = require("path");
const sinon = require("sinon");

const createMiddleware = require("../lib/assetMiddleware");
const ImportResolver = require("../lib/ImportResolver");

const TEST_DATA = path.join(__dirname, "..", "testdata");
const TEST_DATA_EXAMPLE_MODULE = path.join(TEST_DATA, "example-module");
const TEST_DATA_EXAMPLE_NPM = path.join(TEST_DATA, "example-npm");
const TEST_DATA_EXAMPLE_RELATIONS = path.join(TEST_DATA, "example-relations");

function createMockPathMonitor() {
  return {
    getAsset: sinon.stub().named("getAsset"),
    loadAsset: sinon.stub().named("loadAsset")
  };
}

describe("asset middleware", function() {
  it("should throw if a node_modules folder cannot be located", () => {
    const servePath = fs.realpathSync(os.tmpdir());

    expect(
      () => {
        createMiddleware({ servePath });
      },
      "to throw",
      "unable to determine nearest node_modules"
    );
  });

  describe("when serving node_modules", function() {
    let middleware;

    beforeEach(function() {
      const servePath = TEST_DATA_EXAMPLE_NPM;
      const importResolver = new ImportResolver({ servePath });
      const result = createMiddleware({
        importResolver,
        servePath,
        pathMonitor: {}
      });
      middleware = result.middleware;
    });

    it("should respond with a 200 and content-type of application/json", async function() {
      await expect(middleware, "to yield exchange", {
        request: {
          url: "/__node_modules/unexpected/build/lib/index.js"
        },
        response: {
          statusCode: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8"
          }
        }
      });
    });

    it("should respond for a path nested within a package", async function() {
      await expect(middleware, "to yield exchange", {
        request: {
          url: "/__node_modules/sockette/dist/sockette.min.js"
        },
        response: {
          statusCode: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8"
          }
        }
      });
    });

    it("should respond for a nested path within a namespaced package", async function() {
      await expect(middleware, "to yield exchange", {
        request: {
          url: "/__node_modules/@depository/store/dist/store.esm.js"
        },
        response: {
          statusCode: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8"
          }
        }
      });
    });

    it("should respond with rewritten paths", async function() {
      await expect(middleware, "to yield exchange", {
        request: {
          url: "/__node_modules/htm/preact/index.module.js"
        },
        response: {
          body: expect.it("to contain", "/__node_modules/")
        }
      });
    });

    it("should respond for the local client code", async function() {
      await expect(middleware, "to yield exchange", {
        request: {
          url: "/__node_modules/relivestyle/lib/frontend/client.js"
        },
        response: {
          statusCode: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8"
          }
        }
      });
    });

    it("should respond with a 404 for a missing file", async function() {
      await expect(middleware, "to yield exchange", {
        request: {
          url: "/__node_modules/@depository/store/dist/index.js"
        },
        response: {
          statusCode: 404
        }
      });
    });
  });

  describe("when serving HTML", function() {
    const htmlPath = path.join(TEST_DATA_EXAMPLE_MODULE, "stuff.html");
    const htmlContent = fs.readFileSync(htmlPath, "utf8");
    let pathMonitor;
    let middleware;

    beforeEach(function() {
      pathMonitor = createMockPathMonitor();
      pathMonitor.loadAsset.resolves({
        asset: {
          text: htmlContent
        },
        get hash() {
          return 123;
        }
      });
      const result = createMiddleware({
        servePath: TEST_DATA_EXAMPLE_MODULE,
        pathMonitor
      });
      middleware = result.middleware;
    });

    it("should respond with a 200 and content-type of text/html", async function() {
      await expect(middleware, "to yield exchange", {
        request: {
          url: "/stuff.html"
        },
        response: {
          statusCode: 200,
          headers: {
            "Content-Type": "text/html"
          }
        }
      });
    });

    it("should respond with the content adding the socket client", async function() {
      await expect(middleware, "to yield exchange", {
        request: {
          url: "/stuff.html"
        },
        response: {
          body: expect.it("to contain", "/__node_modules/")
        }
      });
    });

    it("should respond with index.html on a request for /", async function() {
      const { middleware } = createMiddleware({
        servePath: path.join(TEST_DATA, "example-index"),
        pathMonitor
      });

      await expect(middleware, "to yield exchange", {
        request: {
          url: "/"
        },
        response: {
          statusCode: 200
        }
      });
    });

    it("should respond with the html on a request without extension", async function() {
      const { middleware } = createMiddleware({
        servePath: path.join(TEST_DATA, "example-project"),
        pathMonitor
      });

      await expect(middleware, "to yield exchange", {
        request: {
          url: "/stuff"
        },
        response: {
          statusCode: 200
        }
      });
    });

    it("should respond with a 404 if the file does not exist", async function() {
      await expect(middleware, "to yield exchange", {
        request: {
          url: "/"
        },
        response: {
          statusCode: 404
        }
      });
    });

    it("should respond with a 404 if loading fails", async function() {
      pathMonitor.loadAsset.resolves(null);

      await expect(middleware, "to yield exchange", {
        request: {
          url: "/xxx.html"
        },
        response: {
          statusCode: 404
        }
      });
    });

    it("should respond with a 304 on an ETag match", async function() {
      pathMonitor.getAsset.returns({ hash: 123 });

      await expect(middleware, "to yield exchange", {
        request: {
          url: "/stuff.html",
          headers: {
            "If-None-Match": '"123"'
          }
        },
        response: {
          statusCode: 304
        }
      });
    });

    it("should not respond with a 304 on a ETag mismatch", async function() {
      pathMonitor.getAsset.returns({ hash: 456 });

      await expect(middleware, "to yield exchange", {
        request: {
          url: "/stuff.html",
          headers: {
            "If-None-Match": '"123"'
          }
        },
        response: {
          statusCode: 200
        }
      });
    });
  });

  describe("when serving JS", function() {
    const jsPath = path.join(TEST_DATA_EXAMPLE_NPM, "stuff.js");
    const jsContent = fs.readFileSync(jsPath, "utf8");
    let pathMonitor;
    let middleware;

    beforeEach(function() {
      pathMonitor = createMockPathMonitor();
      pathMonitor.loadAsset.resolves({
        asset: {
          text: jsContent
        }
      });
      const result = createMiddleware({
        servePath: TEST_DATA_EXAMPLE_MODULE,
        pathMonitor
      });
      middleware = result.middleware;
    });

    it("should respond with a 200 and content-type of application/json", async function() {
      await expect(middleware, "to yield exchange", {
        request: {
          url: "/stuff.js"
        },
        response: {
          statusCode: 200,
          headers: {
            "Content-Type": "application/javascript"
          }
        }
      });
    });

    it("should respond with a 404 if loading fails", async function() {
      pathMonitor.loadAsset.resolves(null);

      await expect(middleware, "to yield exchange", {
        request: {
          url: "/xxx.js"
        },
        response: {
          statusCode: 404
        }
      });
    });
  });

  describe("when serving CSS", function() {
    const filePath = path.join(TEST_DATA_EXAMPLE_RELATIONS, "stuff.css");
    const fileContent = fs.readFileSync(filePath, "utf8");
    let pathMonitor;
    let middleware;

    beforeEach(function() {
      pathMonitor = createMockPathMonitor();
      pathMonitor.loadAsset.resolves({
        asset: {
          text: fileContent
        }
      });
      const result = createMiddleware({
        servePath: TEST_DATA_EXAMPLE_RELATIONS,
        pathMonitor
      });
      middleware = result.middleware;
    });

    it("should respond with a 200 and content-type of application/json", async function() {
      await expect(middleware, "to yield exchange", {
        request: {
          url: "/stuff.css"
        },
        response: {
          statusCode: 200,
          headers: {
            "Content-Type": "text/css"
          }
        }
      });
    });
  });
});
