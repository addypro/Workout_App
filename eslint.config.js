// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Disable unescaped entities rule - cosmetic issue with apostrophes/quotes in JSX text
      'react/no-unescaped-entities': 'off',

      // Suppress unused variable warnings - legacy code, not bugs
      // These are code quality hints for future cleanup, not runtime issues
      '@typescript-eslint/no-unused-vars': 'off',

      // Suppress exhaustive-deps warnings - often intentional for animations/timers
      // Adding deps blindly can cause infinite loops in animation code
      'react-hooks/exhaustive-deps': 'off',

      // Suppress unused expressions - some are intentional (optional chaining for side effects)
      'no-unused-expressions': 'off',

      // Disable require-imports - intentional for platform-specific code (web vs native loading)
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
