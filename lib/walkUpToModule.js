const fs = require("fs");
const path = require("path");

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function checkPackage(pathParts) {
  const pkgFilePath = `/${path.join(...pathParts, "package.json")}`;
  return isFile(pkgFilePath) ? path.dirname(pkgFilePath) : null;
}

function walkUp(modulePath, options) {
  options = options || {};
  const isMonorepo = !!options.isMonorepo;

  const moduleDirParts = path.dirname(modulePath).split(path.sep);
  const relativeParts = [path.basename(modulePath)];
  while (moduleDirParts.length > 1) {
    if (moduleDirParts[moduleDirParts.length - 2] === "node_modules") {
      let moduleName = moduleDirParts.pop();

      // determine the module name taking namespaces info account
      if (/^@/.test(moduleName) && relativeParts.length > 0) {
        const namespacedModuleName = relativeParts.shift();
        moduleName = `${moduleName}/${namespacedModuleName}`;
      }

      const moduleDir = moduleDirParts.join("/");
      const moduleAndNameDir = path.join(moduleDir, moduleName);
      let moduleFilePath = path.relative(moduleAndNameDir, modulePath);
      if (moduleFilePath !== "") moduleFilePath = `/${moduleFilePath}`;

      // In the case of a hoisted module the on-disk path may itself
      // be relative - detect the case by checking whether the module
      // is located within the node_modules path (from which any bare
      // modules are served by the asset middleware) - so in case of
      // no match construct a relative path to the module for return.
      if (moduleDir !== options.nodeModulesPath) {
        const relativeDir = path.relative(options.rootDir, moduleDir);
        moduleName = `${relativeDir}/${moduleName}`;
      }

      return { moduleDir, moduleName, moduleFilePath };
    } else {
      relativeParts.unshift(moduleDirParts.pop());
    }
  }

  const pkgDirParts = isMonorepo
    ? path.dirname(modulePath).split(path.sep)
    : [];
  const pkgFileParts = [path.basename(modulePath)];
  let pkgDir;
  while (pkgDirParts.length > 1) {
    // Within a monorepo the resolved module may be within a
    // node_modules folder rooted at an adjacent package and
    // thus would have fallen through modules directory search
    // code above. Perform another search looking taking care
    // to check for a valid package root account for this.
    if ((pkgDir = checkPackage(pkgDirParts)) !== null) {
      const moduleFilePath = `/${pkgFileParts.join(path.sep)}`;
      const moduleName = path.relative(options.rootDir, pkgDir);
      return { moduleDir: pkgDir, moduleName, moduleFilePath };
    }

    pkgFileParts.unshift(pkgDirParts.pop());
  }

  throw new Error(`invalid module path "${modulePath}"`);
}

exports.walkUpToModuleAndFile = function(modulePath, options) {
  return walkUp(modulePath, options);
};
