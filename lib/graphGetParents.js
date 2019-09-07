const compileQuery = require("assetgraph/lib/compileQuery");

module.exports = function graphGetParents(asset, assetQuery) {
    const assetMatcher = compileQuery(assetQuery);
    const seenAssets = new Set();
    const parents = [];

    (function visit(asset) {
        if (seenAssets.has(asset)) {
            return;
        }
        seenAssets.add(asset);

        for (const incomingRelation of asset.incomingRelations) {
            if (assetMatcher(incomingRelation.from)) {
                parents.push(incomingRelation.from);
            } else {
                visit(incomingRelation.from);
            }
        }
    })(asset);

    return parents;
};
