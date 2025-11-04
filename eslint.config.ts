// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import pluginJs from '@eslint/js'
import pluginI18n from '@intlify/eslint-plugin-vue-i18n'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import { importX } from 'eslint-plugin-import-x'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import storybook from 'eslint-plugin-storybook'
import unusedImports from 'eslint-plugin-unused-imports'
import pluginVue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import {
  configs as tseslintConfigs,
  parser as tseslintParser
} from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

const extraFileExtensions = ['.vue']

const commonGlobals = {
  ...globals.browser,
  __COMFYUI_FRONTEND_VERSION__: 'readonly'
} as const

const settings = {
  'import-x/resolver-next': [
    createTypeScriptImportResolver({
      alwaysTryTypes: true,
      project: [
        './tsconfig.json',
        './apps/*/tsconfig.json',
        './packages/*/tsconfig.json'
      ],
      noWarnOnMultipleProjects: true
    })
  ]
} as const

const commonParserOptions = {
  parser: tseslintParser,
  projectService: true,
  tsConfigRootDir: import.meta.dirname,
  ecmaVersion: 2020,
  sourceType: 'module',
  extraFileExtensions
} as const

export default defineConfig([
  {
    ignores: [
      '.i18nrc.cjs',
      'components.d.ts',
      'lint-staged.config.js',
      'vitest.setup.ts',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      'packages/registry-types/src/comfyRegistryTypes.ts',
      'src/extensions/core/*',
      'src/scripts/*',
      'src/types/generatedManagerTypes.ts',
      'src/types/vue-shim.d.ts'
    ]
  },
  {
    files: ['./**/*.{ts,mts}'],
    settings,
    languageOptions: {
      globals: commonGlobals,
      parserOptions: {
        ...commonParserOptions,
        projectService: {
          allowDefaultProject: [
            'vite.electron.config.mts',
            'vite.types.config.mts'
          ]
        }
      }
    }
  },
  {
    files: ['./**/*.vue'],
    settings,
    languageOptions: {
      globals: commonGlobals,
      parser: vueParser,
      parserOptions: commonParserOptions
    }
  },
  pluginJs.configs.recommended,

  tseslintConfigs.recommended,
  // Difference in typecheck on CI vs Local
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore Bad types in the plugin
  pluginVue.configs['flat/recommended'],
  eslintPluginPrettierRecommended,
  storybook.configs['flat/recommended'],
  // @ts-expect-error Bad types in the plugin
  importX.flatConfigs.recommended,
  // @ts-expect-error Bad types in the plugin
  importX.flatConfigs.typescript,
  {
    plugins: {
      'unused-imports': unusedImports,
      // @ts-expect-error Bad types in the plugin
      '@intlify/vue-i18n': pluginI18n
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-empty-object-type': [
        'error',
        {
          allowInterfaces: 'always'
        }
      ],
      'import-x/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      'import-x/no-useless-path-segments': 'error',
      'import-x/no-relative-packages': 'error',
      'unused-imports/no-unused-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'vue/no-v-html': 'off',
      // Enforce dark-theme: instead of dark: prefix
      'vue/no-restricted-class': ['error', '/^dark:/'],
      'vue/multi-word-component-names': 'off', // TODO: fix
      'vue/no-template-shadow': 'off', // TODO: fix
      'vue/match-component-import-name': 'error',
      /* Toggle on to do additional until we can clean up existing violations.
      'vue/no-unused-emit-declarations': 'error',
      'vue/no-unused-properties': 'error',
      'vue/no-unused-refs': 'error',
      'vue/no-use-v-else-with-v-for': 'error',
      'vue/no-useless-v-bind': 'error',
      // */
      'vue/one-component-per-file': 'off', // TODO: fix
      'vue/require-default-prop': 'off', // TODO: fix -- this one is very worthwhile
      // Restrict deprecated PrimeVue components
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'primevue/calendar',
              message:
                'Calendar is deprecated in PrimeVue 4+. Use DatePicker instead: import DatePicker from "primevue/datepicker"'
            },
            {
              name: 'primevue/dropdown',
              message:
                'Dropdown is deprecated in PrimeVue 4+. Use Select instead: import Select from "primevue/select"'
            },
            {
              name: 'primevue/inputswitch',
              message:
                'InputSwitch is deprecated in PrimeVue 4+. Use ToggleSwitch instead: import ToggleSwitch from "primevue/toggleswitch"'
            },
            {
              name: 'primevue/overlaypanel',
              message:
                'OverlayPanel is deprecated in PrimeVue 4+. Use Popover instead: import Popover from "primevue/popover"'
            },
            {
              name: 'primevue/sidebar',
              message:
                'Sidebar is deprecated in PrimeVue 4+. Use Drawer instead: import Drawer from "primevue/drawer"'
            }
          ]
        }
      ],
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
  {
    files: ['tests-ui/**/*'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { disallowTypeAnnotations: false }
      ]
    }
  },
  {
    files: ['**/*.spec.ts'],
    ignores: ['browser_tests/tests/**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message: '.spec.ts files are only allowed under browser_tests/tests/'
        }
      ]
    }
  },
  {
    files: ['browser_tests/tests/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message:
            '.test.ts files are not allowed in browser_tests/tests/; use .spec.ts instead'
        }
      ]
    }
  },
  {
    files: ['**/*.{test,spec,stories}.ts', '**/*.stories.vue'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': 'off'
    }
  }
])
