import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default [
  {
    files: ['src/**/*.{js,mjs,cjs,ts,vue}']
  },
  {
    ignores: [
      'src/scripts/*',
      'src/extensions/core/*',
      'src/types/vue-shim.d.ts'
    ]
  },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['src/**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } }
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/prefer-as-const': 'off'
    }
  }
]
