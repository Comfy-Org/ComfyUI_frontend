import globals from 'globals'

export default [
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // The pack's own entry point, injected by the harness.
        comfy: 'readonly'
      }
    },
    // Only no-undef. A converted file that references an identifier which no
    // longer exists is syntactically valid, so the ESM parse check passes and
    // it dies at load instead — the WAN_Compare.js failure exactly.
    rules: { 'no-undef': 'error' }
  }
]
