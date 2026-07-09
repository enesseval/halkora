module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo automatically adds the react-native-worklets/plugin
    // (Reanimated 4). We intentionally do NOT use nativewind's jsxImportSource
    // global JSX interop: on native it drops Pressable's *function* style prop
    // (style={({pressed}) => ...}), which silently removed card/button
    // backgrounds on device. All styling goes through src/theme/tokens.ts.
    presets: ['babel-preset-expo'],
  };
};
