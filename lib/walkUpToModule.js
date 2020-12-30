const path = require("path");

function walkUp(modulePath) {
    const moduleDirParts = path.dirname(modulePath).split(path.sep);
    const relativeParts = [path.basename(modulePath)];
    while (moduleDirParts.length > 1) {
        if (
            // normally installed modules
            moduleDirParts[moduleDirParts.length - 2] === "node_modules" ||
            // workaround to support the path to the frontend client code
            moduleDirParts[moduleDirParts.length - 1] === "relivestyle"
        ) {
            const moduleDir = moduleDirParts.join("/");
            const moduleName = moduleDirParts[moduleDirParts.length - 1];
            let moduleFilePath = path.relative(moduleDir, modulePath);
            if (moduleFilePath !== "") moduleFilePath = `/${moduleFilePath}`;
            return { moduleDir, moduleName, moduleFilePath };
        } else {
            relativeParts.unshift(moduleDirParts.pop());
        }
    }
    throw new Error("invalid module path");
}

exports.walkUpToModule = function(modulePath) {
    return walkUp(modulePath).moduleDir;
};

exports.walkUpToModuleAndFile = function(modulePath) {
    return walkUp(modulePath);
};
