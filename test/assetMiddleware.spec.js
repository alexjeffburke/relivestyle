const expect = require("unexpected")
  .clone()
  .use(require("unexpected-express"))
  .use(require("unexpected-snapshot"));
const fs = require("fs");
const path = require("path");
const sinon = require("sinon");

const createMiddleware = require("../lib/assetMiddleware");
const ImportResolver = require("../lib/ImportResolver");
const PathMonitor = require("../lib/PathMonitor");
const { determineNearestNodeModules } = require("../lib/tasteServePath");

const TEST_DATA = path.join(__dirname, "..", "testdata");
const TEST_DATA_EXAMPLE_IMAGE = path.join(TEST_DATA, "example-image");
const TEST_DATA_EXAMPLE_MODULE = path.join(TEST_DATA, "example-module");
const TEST_DATA_EXAMPLE_NPM = path.join(TEST_DATA, "example-npm");
const TEST_DATA_EXAMPLE_RELATIONS = path.join(TEST_DATA, "example-relations");
const TEST_DATA_EXAMPLE_LERNA_DEMO_DIR = path.join(
  TEST_DATA,
  "example-lerna",
  "demo"
);

function createMockPathMonitor() {
  return {
    getAsset: sinon.stub().named("getAsset"),
    loadAsset: sinon.stub().named("loadAsset")
  };
}

function toNodeModulesPath(servePath) {
  return determineNearestNodeModules(servePath).nodeModulesPath;
}

describe("asset middleware", function() {
  describe("when serving node_modules", function() {
    let middleware;

    function middlewareForServePath(servePath) {
      const nodeModulesPath = toNodeModulesPath(servePath);
      const importResolver = new ImportResolver({ servePath, nodeModulesPath });
      const result = createMiddleware({
        importResolver,
        pathMonitor: {},
        servePath,
        nodeModulesPath
      });
      return result.middleware;
    }

    beforeEach(() => {
      middleware = middlewareForServePath(TEST_DATA_EXAMPLE_NPM);
    });

    it("should respond with a 200 and content-type of application/javascript", async function() {
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

    it("should respond for a hoisted path within a workspace", async function() {
      const servePath = TEST_DATA_EXAMPLE_LERNA_DEMO_DIR;
      const nodeModulesPath = toNodeModulesPath(servePath);
      const { middleware } = createMiddleware({
        importResolver: new ImportResolver({
          isMonorepo: true,
          servePath,
          nodeModulesPath
        }),
        pathMonitor: {},
        servePath,
        nodeModulesPath
      });

      await expect(middleware, "to yield exchange", {
        request: {
          url: "/__node_modules/~/3/node_modules/htm/preact/index.module.js"
        },
        response: {
          statusCode: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8"
          }
        }
      });
    });

    it("should respond for a hoisted namespaced path within a workspace", async function() {
      const servePath = TEST_DATA_EXAMPLE_LERNA_DEMO_DIR;
      const nodeModulesPath = toNodeModulesPath(servePath);
      const { middleware } = createMiddleware({
        importResolver: new ImportResolver({
          isMonorepo: true,
          servePath,
          nodeModulesPath
        }),
        pathMonitor: {},
        servePath,
        nodeModulesPath
      });

      await expect(middleware, "to yield exchange", {
        request: {
          url:
            "/__node_modules/~/3/node_modules/@nano-router/router/src/index.js"
        },
        response: {
          statusCode: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8"
          }
        }
      });
    });

    it("should respond for a nested path within a workspace", async function() {
      const servePath = TEST_DATA_EXAMPLE_LERNA_DEMO_DIR;
      const nodeModulesPath = toNodeModulesPath(servePath);
      const { middleware } = createMiddleware({
        importResolver: new ImportResolver({
          isMonorepo: true,
          servePath,
          nodeModulesPath
        }),
        pathMonitor: {},
        servePath,
        nodeModulesPath
      });

      await expect(middleware, "to yield exchange", {
        request: {
          url: "/__node_modules/~/1/packages/internals/index.js"
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

    it("should respond for the internal socket module", async function() {
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

    describe("when node_modules has non-JavaScript content", () => {
      beforeEach(() => {
        middleware = middlewareForServePath(TEST_DATA_EXAMPLE_IMAGE);
      });

      it("should serve an image/gif", async function() {
        await expect(middleware, "to yield exchange", {
          request: {
            url: "/__node_modules/catimages/lasercat.gif"
          },
          response: {
            statusCode: 200,
            headers: {
              "Content-Type": /^image\/gif/
            },
            body: expect.it("to be a", Buffer).and(buffer => {
              expect(
                buffer.slice(0, 5),
                "to equal",
                Buffer.from("GIF89", "ascii")
              );
            })
          }
        });
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

    describe("when permitting client side routing", () => {
      it("should respond with index.html if the file does not exist", async () => {
        const { middleware } = createMiddleware({
          servePath: path.join(TEST_DATA, "example-index"),
          pathMonitor,
          permitClientSideRouting: true
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

  describe("when paired with a real PathMonitor", () => {
    describe("when serving HTML", () => {
      it("should correctly generate an ETag", async function() {
        const servePath = path.join(TEST_DATA, "example-index");
        const { middleware } = createMiddleware({
          servePath,
          pathMonitor: new PathMonitor({
            servePath,
            importResolver: {
              rewrite: () => ""
            }
          })
        });

        await expect(middleware, "to yield exchange", {
          request: {
            url: "/index.html"
          },
          response: {
            statusCode: 200,
            headers: {
              "Content-Type": "text/html",
              ETag: '"7847c27e9f8cb6da74f7b5572a51c601235e04e1"'
            }
          }
        });
      });
    });

    describe("when serving JS", () => {
      it("should correctly generate an ETag", async function() {
        const servePath = path.join(TEST_DATA, "example-delicate");
        const { middleware } = createMiddleware({
          servePath,
          pathMonitor: new PathMonitor({
            servePath,
            importResolver: {
              rewrite: () => ""
            }
          })
        });

        await expect(middleware, "to yield exchange", {
          request: {
            url: "/example.js"
          },
          response: {
            statusCode: 200,
            headers: {
              "Content-Type": "application/javascript",
              ETag: '"ad185e63393f77f73727b05bc345e9595d8c93d8"'
            }
          }
        });
      });
    });

    describe("when serving CSS", () => {
      it("should correctly generate an ETag", async function() {
        const servePath = path.join(TEST_DATA, "example-relations");
        const { middleware } = createMiddleware({
          servePath,
          pathMonitor: new PathMonitor({
            servePath,
            importResolver: {
              rewrite: () => ""
            }
          })
        });

        await expect(middleware, "to yield exchange", {
          request: {
            url: "/stuff.css"
          },
          response: {
            statusCode: 200,
            headers: {
              "Content-Type": "text/css",
              ETag: '"30681e85e6a19e7c02e5432d0984b31f66b5bb7f"'
            }
          }
        });
      });
    });
  });
});
