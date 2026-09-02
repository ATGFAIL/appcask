const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// This project lives inside the appcask monorepo and depends on the pure
// @appcask/* packages via `file:` links. Metro needs to watch the repo root so
// it picks up changes to those packages, and to resolve modules from both the
// project's and the root's node_modules.
const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = {
  watchFolders: [repoRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(repoRoot, 'node_modules'),
    ],
    // Prevent duplicate React copies from the workspace root.
    disableHierarchicalLookup: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
