// Metro configuration
// Prevent Metro from ever trying to transform the huge Kaggle JSON file.
// This avoids web/dev-server crashes like:
// "Bad control character in string literal in JSON ... JSON.parse ..."

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Blocklist the raw Kaggle file (we use the optimized `data/programs-light.json` instead)
config.resolver.blockList = [
  /\/data\/workout-programs\.json$/,
];

module.exports = config;


