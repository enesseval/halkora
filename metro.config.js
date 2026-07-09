const { getDefaultConfig } = require('expo/metro-config');

// NativeWind's metro/global-css interop is intentionally disabled — see
// babel.config.js. The app is styled entirely via src/theme/tokens.ts.
module.exports = getDefaultConfig(__dirname);
