const fs = require("fs");
const path = require("path");

const HTML_EXTENSIONS = [".html", ".htm"];
const JS_EXTENSIONS = [".js", ".mjs", ".cjs"];
const CSS_EXTENSIONS = [".css"];

function isFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile) {
      throw new Error("invalid");
    }
    return true;
  } catch (e) {
    return false;
  }
}

function determineRelevance(assetPath) {
  const ext = path.extname(assetPath);

  if (HTML_EXTENSIONS.includes(ext)) {
    return "html";
  } else if (JS_EXTENSIONS.includes(ext)) {
    return "js";
  } else if (ext === CSS_EXTENSIONS[0]) {
    return "css";
  } else {
    return "none";
  }
}

function normalisePath(assetPath, rootDir, options) {
  options = options || {};

  if (assetPath === "/" && isFile(path.join(rootDir, "index.html"))) {
    // handle a root level index.html file
    return "/index.html";
  } else if (
    path.extname(assetPath) === "" &&
    isFile(path.join(rootDir, `${assetPath.slice(1)}.html`))
  ) {
    // match the behaviour of serve-static
    return `/${assetPath.slice(1)}.html`;
  } else if (
    path.extname(assetPath) === "" &&
    options.permitClientSideRouting
  ) {
    // override missing unsuffixed paths when doing routing on the client
    return "/index.html";
  } else {
    return assetPath;
  }
}

exports.determineRelevance = determineRelevance;
exports.normalisePath = normalisePath;
