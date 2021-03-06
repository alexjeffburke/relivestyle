const findUp = require("find-up");
const fs = require("fs");
const path = require("path");

function determineNearestNodeModules(cwd) {
  const pkg = findUp.sync("package.json", { cwd, type: "file" });
  if (pkg === undefined) {
    throw new Error("unable to determine nearest node_modules");
  }

  const packagePath = path.dirname(pkg);
  const nodeModulesPath = path.join(packagePath, "node_modules");

  return {
    packagePath,
    nodeModulesPath
  };
}

function hasConfigKey(pkgJson, key) {
  try {
    const pkgContent = fs.readFileSync(pkgJson, "utf8");
    const pkg = JSON.parse(pkgContent);
    return !!pkg[key];
  } catch {
    return false;
  }
}

function isLerna(servePath) {
  const packagePath = findUp.sync("lerna.json", {
    cwd: servePath,
    type: "file"
  });
  return hasConfigKey(packagePath, "packages");
}

function isWorkspaces(servePath) {
  const maybeSubPackage = findUp.sync("package.json", {
    cwd: servePath,
    type: "file"
  });
  if (maybeSubPackage === undefined) return false;
  if (hasConfigKey(maybeSubPackage, "workspaces")) return true;
  const parentFromPath = path.resolve(path.dirname(maybeSubPackage), "..");
  const parentPackage = findUp.sync("package.json", {
    cwd: parentFromPath,
    type: "file"
  });
  if (parentPackage === undefined) return false;
  return hasConfigKey(parentPackage, "workspaces");
}

function tasteServePath(servePath) {
  let servePathStat;
  try {
    servePathStat = fs.statSync(servePath);
  } catch (e) {
    throw new Error("servePath: supplied path was not found");
  }
  if (!servePathStat.isDirectory) {
    throw new Error("servePath: supplied path was not a directory");
  }

  const isMonorepo = isLerna(servePath) || isWorkspaces(servePath);
  const { packagePath, nodeModulesPath } = determineNearestNodeModules(
    servePath
  );

  return { servePath, packagePath, nodeModulesPath, isMonorepo };
}

exports.determineNearestNodeModules = determineNearestNodeModules;
exports.tasteServePath = tasteServePath;
