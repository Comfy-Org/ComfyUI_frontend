/**
 * Strict ESLint config for the sonarjs-lint review check.
 *
 * Uses eslint-plugin-sonarjs to get SonarQube-grade analysis without a server.
 * This config is NOT used for regular development linting — only for the
 * code review checks' static analysis pass.
 *
 * Install: pnpm add -D eslint eslint-plugin-sonarjs
 * Run:     pnpm dlx eslint --no-config-lookup --config .agents/checks/eslint.strict.config.js --ext .ts,.js,.vue {files}
 */

import sonarjs from 'eslint-plugin-sonarjs'

export default [
  sonarjs.configs.recommended,
  {
    plugins: {
      sonarjs
    },
    rules: {
      // Bug detection
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-element-overwrite': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-one-iteration-loop': 'error',
      'sonarjs/no-use-of-empty-return-value': 'error',
      'sonarjs/no-collection-size-mischeck': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/no-unused-collection': 'error',
      'sonarjs/no-gratuitous-expressions': 'error',

      // Code smell detection
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
      'sonarjs/no-redundant-boolean': 'error',
      'sonarjs/no-small-switch': 'error',
      'sonarjs/prefer-immediate-return': 'error',
      'sonarjs/prefer-single-boolean-return': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
      'sonarjs/no-nested-template-literals': 'error'
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module'
    }
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.config.*',
      '**/*.test.*',
      '**/*.spec.*'
    ]
  }
]
