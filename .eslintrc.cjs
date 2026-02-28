module.exports = {
  root: true,
  env: {
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.config.js'],
  overrides: [
    {
      // Browser-only code (extension)
      files: ['packages/extension/**/*.ts', 'packages/extension/**/*.tsx'],
      env: {
        browser: true,
      },
    },
    {
      // Node-only code (backend)
      files: ['packages/backend/**/*.ts'],
      env: {
        node: true,
      },
    },
  ],
}
