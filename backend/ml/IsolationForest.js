class IsolationTree {
    constructor(data, heightLimit) {
        this.heightLimit = heightLimit;
        if (heightLimit <= 0 || data.length <= 1) {
            this.size = data.length;
            this.isExternal = true;
            return;
        }
        const numFeatures = data[0].length;
        const featureIdx = Math.floor(Math.random() * numFeatures);
        const values = data.map(d => d[featureIdx]);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        if (minVal === maxVal) {
            this.size = data.length;
            this.isExternal = true;
            return;
        }
        this.splitFeature = featureIdx;
        this.splitValue = Math.random() * (maxVal - minVal) + minVal;
        this.left = new IsolationTree(data.filter(d => d[this.splitFeature] < this.splitValue), heightLimit - 1);
        this.right = new IsolationTree(data.filter(d => d[this.splitFeature] >= this.splitValue), heightLimit - 1);
        this.isExternal = false;
    }
}

function pathLength(point, tree, currentPath) {
    if (tree.isExternal) {
        if (tree.size <= 1) return currentPath;
        const c = 2 * (Math.log(tree.size - 1) + 0.5772156649) - (2 * (tree.size - 1) / tree.size);
        return currentPath + c;
    }
    if (point[tree.splitFeature] < tree.splitValue) return pathLength(point, tree.left, currentPath + 1);
    return pathLength(point, tree.right, currentPath + 1);
}

class IsolationForest {
    constructor(data, numTrees = 100, sampleSize = 256) {
        this.trees = [];
        const n = Math.min(sampleSize, data.length);
        const heightLimit = 10;
        for (let i = 0; i < numTrees; i++) {
            const sample = [];
            for (let j = 0; j < n; j++) sample.push(data[Math.floor(Math.random() * data.length)]);
            if (sample.length > 1) this.trees.push(new IsolationTree(sample, heightLimit));
        }
    }
    score(point) {
        if (this.trees.length === 0) return 0.5;
        const avgPathLength = this.trees.reduce((acc, tree) => acc + pathLength(point, tree, 0), 0) / this.trees.length;
        const n = 64;
        const c = 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
        return Math.pow(2, -avgPathLength / c);
    }
}

module.exports = { IsolationForest };
