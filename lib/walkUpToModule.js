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
            let moduleName = moduleDirParts.pop();

            // determine the module name taking namespaces info account
            if (/^@/.test(moduleName) && relativeParts.length > 0) {
                const namespacedModuleName = relativeParts.shift();
                moduleName = `${moduleName}/${namespacedModuleName}`;
            }

            const moduleDir = `${moduleDirParts.join("/")}/${moduleName}`;
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
