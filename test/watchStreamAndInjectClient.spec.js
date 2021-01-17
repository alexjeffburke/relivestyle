const expect = require("unexpected")
  .clone()
  .use(require("unexpected-express"))
  .use(require("unexpected-snapshot"));
const fs = require("fs");
const path = require("path");
const stream = require("stream");

const TEST_DATA = path.join(__dirname, "..", "testdata");
const TEST_DATA_EXAMPLE_INJECTION = path.join(TEST_DATA, "example-injection");

const watchStreamAndInjectClient = require("../lib/watchStreamAndInjectClient");

function createInputAndOutputForFile(htmlFileName) {
  const htmlPath = path.join(TEST_DATA_EXAMPLE_INJECTION, htmlFileName);
  const fileContent = fs.readFileSync(htmlPath, "utf8");
  const inputStream = new stream.Readable();
  inputStream.push(fileContent, "utf8");
  inputStream.push(null);
  let outputStream;
  const outputPromise = new Promise(resolve => {
    let output = "";
    outputStream = new stream.Writable({
      write(chunk, encoding, callback) {
        output += chunk;
        callback();
      }
    });
    outputStream.on("finish", () => resolve(output));
  });

  return { inputStream, outputStream, outputPromise };
}

describe("watchStreamAndInjectClient", () => {
  it("should add the socket client before the first script", async function() {
    const {
      inputStream,
      outputStream,
      outputPromise
    } = createInputAndOutputForFile("script.html");

    watchStreamAndInjectClient(inputStream, outputStream);

    const output = await outputPromise;
    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            <html>
                <head>
                    <script src="/__node_modules/sockette/dist/sockette.min.js"></script><script src="/__node_modules/relivestyle/lib/frontend/client.js"></script><script>
                        (() => {})();
                    </script>
                </head>
            </html>

        `
    );
  });

  it("should add the socket client in the head", async function() {
    const {
      inputStream,
      outputStream,
      outputPromise
    } = createInputAndOutputForFile("head.html");

    watchStreamAndInjectClient(inputStream, outputStream);

    const output = await outputPromise;
    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            <html>
                <head><script src="/__node_modules/sockette/dist/sockette.min.js"></script><script src="/__node_modules/relivestyle/lib/frontend/client.js"></script></head>
            </html>

        `
    );
  });

  it("should add the socket client in the body", async function() {
    const {
      inputStream,
      outputStream,
      outputPromise
    } = createInputAndOutputForFile("body.html");

    watchStreamAndInjectClient(inputStream, outputStream);

    const output = await outputPromise;
    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            <html>
                <body>
                    foobar
                <script src="/__node_modules/sockette/dist/sockette.min.js"></script><script src="/__node_modules/relivestyle/lib/frontend/client.js"></script></body>
            </html>

        `
    );
  });

  it("should add the socket client in the html", async function() {
    const {
      inputStream,
      outputStream,
      outputPromise
    } = createInputAndOutputForFile("html.html");

    watchStreamAndInjectClient(inputStream, outputStream);

    const output = await outputPromise;
    expect(
      output,
      "to equal snapshot",
      expect.unindent`
            <html><script src="/__node_modules/sockette/dist/sockette.min.js"></script><script src="/__node_modules/relivestyle/lib/frontend/client.js"></script></html>

        `
    );
  });
});
