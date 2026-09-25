// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format

import pluginJs from '@eslint/js'
import pluginI18n from '@intlify/eslint-plugin-vue-i18n'
import { configs as astroConfigs } from 'eslint-plugin-astro'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/api/defaults'
import {
  MatcherType,
  SelectorKind
} from 'eslint-plugin-better-tailwindcss/api/types'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import { importX } from 'eslint-plugin-import-x'
import oxlint from 'eslint-plugin-oxlint'
// eslint-config-prettier disables ESLint rules that conflict with formatters (oxfmt)
import eslintConfigPrettier from 'eslint-config-prettier'
import unusedImports from 'eslint-plugin-unused-imports'
import pluginVue from 'eslint-plugin-vue'
import type { ESLint } from 'eslint'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import {
  configs as tseslintConfigs,
  parser as tseslintParser
} from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'
import path from 'node:path'

import {
  tailwindScriptFiles,
  tailwindScriptIgnores,
  templateFiles
} from './scripts/eslintScope.ts'

const extraFileExtensions = ['.vue']

// Only utilities that resolve a theme token are checked, so a class like
// `text-danger` with no `--color-danger` fails lint while custom CSS hooks
// (`side-bar-button`, `lg-node`, PrimeIcons `pi-*`) stay allowed.
const tailwindTokenUtilityPrefixPattern = [
  'accent',
  'animate',
  'bg',
  'border',
  'caret',
  'decoration',
  'divide',
  'fill',
  'font',
  'from',
  'inset-ring',
  'inset-shadow',
  'outline',
  'placeholder',
  'ring',
  'rounded',
  'shadow',
  'stroke',
  'text',
  'to',
  'via'
].join('|')
const nonTokenUtilityClassPattern = `^(?!(?:.*:)?!?(?:${tailwindTokenUtilityPrefixPattern})-)`

const themeColorUtilityPattern = [
  'accent',
  'bg',
  'border(?:-[trblsexy])?',
  'caret',
  'decoration',
  'divide',
  'fill',
  'from',
  'inset-ring',
  'inset-shadow',
  'outline',
  'placeholder',
  'ring',
  'shadow',
  'stroke',
  'text',
  'to',
  'via'
].join('|')
const specializedThemeTokenPattern = [
  'button-',
  'comfy-',
  'component-',
  'dialog-',
  'input-surface(?:/|$)',
  'interface-',
  'modal-',
  'nav-',
  'node-',
  'text-(?:primary|secondary)(?:/|$)',
  'video-'
].join('|')
const specializedThemeClassPattern = `^(?:.*:)?!?(?:${themeColorUtilityPattern})-(?:${specializedThemeTokenPattern})`

// @ts-expect-error Type incompatibility in i18n plugin
const i18nPlugin: ESLint.Plugin = pluginI18n

// .oxlintrc.json `ignorePatterns` is the shared ignore list for both linters;
// the rest of the oxlint configs switch off ESLint rules oxlint already runs.
const oxlintConfigs = oxlint.buildFromOxlintConfigFile(
  path.resolve(import.meta.dirname, '.oxlintrc.json')
)
const sharedIgnores = oxlintConfigs.filter((config) => !config.rules)
// Astro components are parsed by ESLint only, so they keep every rule.
const rulesCoveredByOxlint = oxlintConfigs
  .filter((config) => config.rules)
  .map((config) => ({
    ...config,
    ignores: [...(config.ignores ?? []), '**/*.astro', '**/*.astro/**']
  }))

const commonGlobals = {
  ...globals.browser,
  __COMFYUI_FRONTEND_VERSION__: 'readonly',
  __COMFYUI_FRONTEND_COMMIT__: 'readonly',
  __DISTRIBUTION__: 'readonly',
  __IS_NIGHTLY__: 'readonly'
} as const

const settings = {
  'import-x/resolver-next': [
    createTypeScriptImportResolver({
      alwaysTryTypes: true,
      project: [
        './tsconfig.json',
        './browser_tests/tsconfig.json',
        './apps/*/tsconfig.json',
        './packages/*/tsconfig.json'
      ],
      noWarnOnMultipleProjects: true
    })
  ],
  'vue-i18n': {
    localeDir: [
      {
        pattern: './src/locales/**/*.json',
        localeKey: 'path',
        localePattern:
          /^\.?\/?src\/locales\/(?<locale>[A-Za-z0-9-]+)\/.+\.json$/
      }
    ],
    messageSyntaxVersion: '^9.0.0'
  }
} as const

const commonParserOptions = {
  parser: tseslintParser,
  ecmaVersion: 2020,
  sourceType: 'module',
  extraFileExtensions
} as const

// Tailwind CSS v4 linting (class ordering, duplicates, conflicts, etc.)
const tailwindConfigs = defineConfig([
  betterTailwindcss.configs.recommended,
  {
    settings: {
      'better-tailwindcss': {
        entryPoint: path.resolve(
          import.meta.dirname,
          'packages/design-system/src/css/style.css'
        ),
        selectors: [
          ...getDefaultSelectors(),
          {
            kind: SelectorKind.Callee,
            name: '^cva$',
            match: [{ type: MatcherType.ObjectValue, path: '^base$' }]
          }
        ]
      }
    },
    rules: {
      'better-tailwindcss/no-unknown-classes': [
        'error',
        { ignore: [nonTokenUtilityClassPattern] }
      ],
      // Off: may conflict with oxfmt formatting
      'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
      // Off: large batch change, enable and apply with `eslint --fix`
      'better-tailwindcss/enforce-consistent-class-order': 'error',
      // collapse (mt-2 mb-2 → my-2) is an unmemoized subset search: ~30 s per lint
      'better-tailwindcss/enforce-canonical-classes': [
        'error',
        { collapse: false }
      ],
      'better-tailwindcss/no-deprecated-classes': 'error'
    }
  },
  {
    name: 'design-system/core-ui-theme-tokens',
    files: ['src/components/ui/**/*.{ts,vue}'],
    rules: {
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          restrict: [
            {
              pattern: specializedThemeClassPattern,
              message:
                'Generic UI components must use core semantic theme tokens instead of specialized tokens.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['apps/billing-web/**/*.{ts,vue}'],
    settings: {
      'better-tailwindcss': {
        entryPoint: path.resolve(
          import.meta.dirname,
          'apps/billing-web/src/styles.css'
        )
      }
    }
  },
  {
    files: ['apps/website/**/*.{astro,ts,mts,vue}'],
    settings: {
      'better-tailwindcss': {
        entryPoint: 'apps/website/src/styles/global.css'
      }
    }
  }
])

export default defineConfig([
  ...sharedIgnores,
  {
    files: tailwindScriptFiles,
    ignores: [...tailwindScriptIgnores, ...templateFiles],
    extends: tailwindConfigs,
    languageOptions: {
      parser: tseslintParser,
      parserOptions: { ecmaVersion: 2020, sourceType: 'module' }
    }
  },
  {
    files: templateFiles,
    extends: [
      {
        files: ['./**/*.{ts,mts}'],
        settings,
        languageOptions: {
          globals: commonGlobals,
          parserOptions: commonParserOptions
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
      {
        // vue-tsc owns undefined-name checks in .vue script blocks
        files: ['**/*.vue'],
        rules: {
          'no-undef': 'off'
        }
      },
      // Difference in typecheck on CI vs Local
      pluginVue.configs['flat/recommended'],
      astroConfigs['flat/recommended'],
      {
        files: ['apps/website/**/*.astro'],
        settings,
        languageOptions: {
          parserOptions: {
            parser: tseslintParser
          }
        }
      },
      {
        files: ['apps/website/**/*.astro/*.{js,ts}'],
        rules: {
          'no-empty': ['error', { allowEmptyCatch: true }]
        }
      },
      ...tailwindConfigs,
      // Disables ESLint rules that conflict with formatters
      eslintConfigPrettier,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
      {
        // oxlint runs this rule elsewhere; it cannot see template usages in SFCs
        files: ['**/*.vue'],
        plugins: { 'unused-imports': unusedImports },
        rules: { 'unused-imports/no-unused-imports': 'error' }
      },
      {
        plugins: { '@intlify/vue-i18n': i18nPlugin },
        rules: {
          '@typescript-eslint/no-explicit-any': 'off',
          '@typescript-eslint/no-unused-vars': 'off',
          '@typescript-eslint/prefer-as-const': 'off',
          '@typescript-eslint/consistent-type-imports': 'error',
          'vue/no-v-html': 'off',
          // Prohibit dark-theme: and dark: prefixes
          'vue/no-restricted-class': ['error', '/^dark(-theme)?:/'],
          'vue/multi-word-component-names': 'off', // TODO: fix
          'vue/no-template-shadow': 'off', // TODO: fix
          'vue/match-component-import-name': 'error',
          'vue/no-unused-properties': 'error',
          'vue/no-unused-refs': 'error',
          'vue/no-useless-mustaches': 'error',
          'vue/no-useless-v-bind': 'error',
          'vue/no-unused-emit-declarations': 'error',
          'vue/no-use-v-else-with-v-for': 'error',
          'vue/one-component-per-file': 'error',
          'vue/require-default-prop': 'off', // TODO: fix -- this one is very worthwhile

          // i18n rules
          '@intlify/vue-i18n/no-raw-text': [
            'error',
            {
              attributes: {
                '/.+/': [
                  'aria-label',
                  'aria-placeholder',
                  'aria-roledescription',
                  'aria-valuetext',
                  'label',
                  'placeholder',
                  'title',
                  'v-tooltip'
                ],
                img: ['alt']
              },
              // Ignore strings that are:
              // 1. Less than 2 characters
              // 2. Only symbols/numbers/whitespace (no letters)
              // 3. Match specific patterns
              ignorePattern:
                '^[^a-zA-Z]*$|^.{0,1}$|^[\\w._%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$',
              ignoreNodes: [
                'md-icon',
                'v-icon',
                'pre',
                'code',
                'script',
                'style'
              ],
              // Brand names and technical terms that shouldn't be translated
              ignoreText: [
                'API',
                'App Data:',
                'App Path:',
                'ComfyUI',
                'CPU',
                'fps',
                'GB',
                'GitHub',
                'GPU',
                'JSON',
                'KB',
                'LoRA',
                'MB',
                'ms',
                'OpenAI',
                'png',
                'px',
                'RAM',
                'URL',
                'YAML',
                '1.2 MB'
              ]
            }
          ]
        }
      },
      {
        files: ['**/*.test.ts'],
        rules: {
          // Tests routinely define stub and harness components side-by-side with
          // the system under test and stub emits for documentation only — these
          // production-SFC rules are noise in a test file.
          'vue/one-component-per-file': 'off',
          'vue/no-reserved-component-names': 'off',
          'vue/no-unused-emit-declarations': 'off'
        }
      },
      {
        // Devtools extension scripts are loaded by ComfyUI in the browser.
        files: ['tools/devtools/web/**/*.js'],
        languageOptions: {
          globals: {
            ...globals.browser
          }
        }
      },

      ...rulesCoveredByOxlint,
      {
        rules: {
          'import-x/default': 'off',
          'import-x/export': 'off',
          'import-x/namespace': 'off',
          'import-x/no-duplicates': 'off',
          'import-x/no-named-as-default': 'off',
          'import-x/consistent-type-specifier-style': 'off'
        }
      },

      // The website app is a marketing site with no vue-i18n setup
      {
        files: ['apps/website/**/*.vue'],
        rules: {
          '@intlify/vue-i18n/no-raw-text': 'off',
          'vue/no-v-html': 'error'
        }
      },
      // Astro exposes virtual modules (astro:content, astro:assets, ...) that the
      // TypeScript resolver cannot see but are valid at build time.
      {
        files: ['apps/website/**/*.{astro,ts,mts,vue}'],
        rules: {
          'import-x/no-unresolved': ['error', { ignore: ['^astro:'] }]
        }
      },
      // reka-ui wrappers forward props via v-bind, which the rule cannot trace.
      {
        files: [
          'apps/website/src/components/ui/accordion/*.vue',
          'apps/website/src/components/ui/dialog/*.vue',
          'apps/website/src/components/ui/navigation-menu/*.vue',
          'apps/website/src/components/ui/sheet/*.vue',
          'apps/website/src/components/ui/slider/*.vue',
          'apps/website/src/components/ui/toggle-group/*.vue'
        ],
        rules: {
          'vue/no-unused-properties': 'off'
        }
      },
      {
        name: 'comfy/enforce-sanitized-html-boundary',
        files: ['src/**/*.vue'],
        rules: {
          'vue/no-v-html': 'error'
        }
      }
    ]
  }
])
