// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import pluginJs from '@eslint/js'
import pluginI18n from '@intlify/eslint-plugin-vue-i18n'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import storybook from 'eslint-plugin-storybook'
import unusedImports from 'eslint-plugin-unused-imports'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  {
    files: ['src/**/*.{js,mjs,cjs,ts,vue}']
  },
  {
    ignores: [
      'src/scripts/*',
      'src/extensions/core/*',
      'src/types/vue-shim.d.ts',
      // Generated files that don't need linting
      'src/types/comfyRegistryTypes.ts',
      'src/types/generatedManagerTypes.ts'
    ]
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        __COMFYUI_FRONTEND_VERSION__: 'readonly'
      },
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.eslint.json'],
        ecmaVersion: 2020,
        sourceType: 'module',
        extraFileExtensions: ['.vue']
      }
    }
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  eslintPluginPrettierRecommended,
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    }
  },
  {
    plugins: {
      'unused-imports': unusedImports,
      '@intlify/vue-i18n': pluginI18n
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      'unused-imports/no-unused-imports': 'error',
      'vue/no-v-html': 'off',
      // i18n rules
      '@intlify/vue-i18n/no-raw-text': [
        'error',
        {
          // Ignore strings that are:
          // 1. Less than 2 characters
          // 2. Only symbols/numbers/whitespace (no letters)
          // 3. Match specific patterns
          ignorePattern:
            '^[^a-zA-Z]*$|^.{0,1}$|^[\\w._%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$',
          ignoreNodes: ['md-icon', 'v-icon', 'pre', 'code', 'script', 'style'],
          // Brand names and technical terms that shouldn't be translated
          ignoreText: [
            'ComfyUI',
            'GitHub',
            'OpenAI',
            'API',
            'URL',
            'JSON',
            'YAML',
            'GPU',
            'CPU',
            'RAM',
            'GB',
            'MB',
            'KB',
            'ms',
            'fps',
            'px',
            'App Data:',
            'App Path:'
          ]
        }
      ]
    }
  },
  ...storybook.configs['flat/recommended']
]
