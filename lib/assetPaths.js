const fs = require("fs");
const path = require("path");

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
    if (/\.html$/.test(assetPath)) {
        return "html";
    } else if (/\.js$/.test(assetPath)) {
        return "js";
    } else {
        return "none";
    }
}

function normalisePath(assetPath, rootDir) {
    if (assetPath === "/" && isFile(path.join(rootDir, "index.html"))) {
        // handle a root level index.html file
        return "/index.html";
    } else if (
        path.extname(assetPath) === "" &&
        isFile(path.join(rootDir, `${assetPath.slice(1)}.html`))
    ) {
        // match the behaviour of serve-static
        return `/${assetPath.slice(1)}.html`;
    } else {
        return assetPath;
    }
}

exports.determineRelevance = determineRelevance;
exports.normalisePath = normalisePath;
