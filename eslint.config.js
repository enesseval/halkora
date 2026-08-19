// Expo's own flat config, which already brings the React and react-hooks
// plugins along. It exists for one concrete reason: `tsc` cannot see a hook
// called after an early return, and that mistake crashed the app twice from
// the same line (see AGENTS.md §3.1). rules-of-hooks catches it.
const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    ignores: [
      'node_modules/**',
      'ios/**',
      'android/**',
      '.expo/**',
      'dist/**',
      'supabase/functions/**', // Deno, not this project's TS config
    ],
  },
  {
    rules: {
      // The whole point of adding lint here — never a warning.
      'react-hooks/rules-of-hooks': 'error',
      // Left as a warning on purpose: the codebase has deliberate,
      // documented omissions from dependency arrays, and turning this into an
      // error would mean rewriting working effects to satisfy a linter.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
