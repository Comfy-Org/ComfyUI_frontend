import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default [
  { files: ['src/**/*.{js,mjs,cjs,ts,vue}'] },
  { languageOptions: { globals: globals.browser } },
  tseslint.configs.base,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } }
  },
  {
    rules: {
      'no-unused-vars': 'off',
      'no-empty': 'off',

      // Following rules should be removed later when the problematic code
      // is fixed.
      'no-prototype-builtins': 'off'
    }
  }
]
