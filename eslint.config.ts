// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import type { Rule } from 'eslint'

import pluginJs from '@eslint/js'
import pluginI18n from '@intlify/eslint-plugin-vue-i18n'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import { importX } from 'eslint-plugin-import-x'
import oxlint from 'eslint-plugin-oxlint'
import testingLibrary from 'eslint-plugin-testing-library'
// eslint-config-prettier disables ESLint rules that conflict with formatters (oxfmt)
import eslintConfigPrettier from 'eslint-config-prettier'
import { configs as storybookConfigs } from 'eslint-plugin-storybook'
import unusedImports from 'eslint-plugin-unused-imports'
import pluginVue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import {
  configs as tseslintConfigs,
  parser as tseslintParser
} from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'
import path from 'node:path'

import { noNewErrorThrow } from './tools/eslint-plugins/noNewErrorThrow'
import { primeVueImportAllowlist } from './scripts/primevue-import-allowlist'

const extraFileExtensions = ['.vue']

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
  projectService: true,
  tsConfigRootDir: import.meta.dirname,
  ecmaVersion: 2020,
  sourceType: 'module',
  extraFileExtensions
} as const

const useVirtualListRestriction = {
  name: '@vueuse/core',
  importNames: ['useVirtualList'],
  message:
    'useVirtualList requires uniform item heights. Use TanStack Virtual (via Reka UI virtualizer or @tanstack/vue-virtual) instead.'
} as const

const reportErrorRestrictions = [
  {
    name: '@sentry/vue',
    importNames: ['captureException'],
    message:
      "Use reportError() from '@/platform/telemetry/reportError'. A raw captureException reaches Sentry only, so the failure stays invisible to every Datadog dashboard and alert."
  },
  {
    name: '@datadog/browser-rum',
    importNames: ['datadogRum'],
    message:
      "Use reportError() from '@/platform/telemetry/reportError'. A raw datadogRum.addError reaches Datadog only, and skips the pre-init buffer that keeps early-boot failures from being dropped."
  }
] as const

const noPrimeVueImports: Rule.RuleModule = {
  meta: {
    type: 'problem',
    messages: {
      banned:
        'New PrimeVue usage is banned per the PrimeVue removal effort. Remove this import. scripts/primevue-import-allowlist.ts only shrinks; do not add entries.'
    },
    schema: []
  },
  create(context) {
    function report(node: Rule.Node, source: unknown) {
      if (
        typeof source === 'string' &&
        /^(?:primevue(?:\/|$)|@primevue(?:\/|$))/.test(source)
      ) {
        context.report({ node, messageId: 'banned' })
      }
    }

    return {
      ImportDeclaration(node) {
        report(node, node.source.value)
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal') {
          report(node, node.source.value)
        }
      },
      ExportNamedDeclaration(node) {
        report(node, node.source?.value)
      },
      ExportAllDeclaration(node) {
        report(node, node.source.value)
      }
    }
  }
}

const primeVueRemovalPlugin = {
  rules: {
    'no-imports': noPrimeVueImports
  }
}

export default defineConfig([
  {
    ignores: [
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      'components.d.ts',
      'coverage/*',
      'dist/*',
      'packages/registry-types/src/comfyRegistryTypes.ts',
      'playwright-report/*',
      'scripts/registry-census/detection-proof/**',
      'src/__ecs_matrix__/**',
      'src/extensions/core/*',
      'src/scripts/*',
      'src/types/generatedManagerTypes.ts',
      'src/types/vue-shim.d.ts',
      'packages/design-system/src/css/lucideStrokePlugin.js',
      'test-results/*',
      'vitest.setup.ts'
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
            'packages/object-info-parser/vitest.config.ts',
            'vite.electron.config.mts',
            'vite.types.config.mts',
            'vitest.matrix.config.mts',
            'vitest.timer.setup.ts'
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
  {
    name: 'primevue-removal/no-imports',
    files: ['src/**/*.{ts,tsx,vue}'],
    plugins: {
      'primevue-removal': primeVueRemovalPlugin
    },
    rules: {
      'primevue-removal/no-imports': 'error'
    }
  },
  {
    name: 'primevue-removal/existing-imports',
    files: [...primeVueImportAllowlist],
    rules: {
      'primevue-removal/no-imports': 'off'
    }
  },
  pluginJs.configs.recommended,

  tseslintConfigs.recommended,
  // Difference in typecheck on CI vs Local
  pluginVue.configs['flat/recommended'],
  // Tailwind CSS v4 linting (class ordering, duplicates, conflicts, etc.)
  betterTailwindcss.configs.recommended,
  {
    settings: {
      'better-tailwindcss': {
        entryPoint: 'packages/design-system/src/css/style.css'
      }
    },
    rules: {
      // Off: requires whitelisting non-Tailwind classes (PrimeIcons, custom CSS)
      'better-tailwindcss/no-unknown-classes': 'off',
      // Off: may conflict with oxfmt formatting
      'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
      // Off: large batch change, enable and apply with `eslint --fix`
      'better-tailwindcss/enforce-consistent-class-order': 'error',
      'better-tailwindcss/enforce-canonical-classes': 'error',
      'better-tailwindcss/no-deprecated-classes': 'error'
    }
  },
  // Disables ESLint rules that conflict with formatters
  eslintConfigPrettier,
  // @ts-expect-error Type incompatibility between storybook plugin and ESLint config types
  storybookConfigs['flat/recommended'],
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    plugins: {
      'unused-imports': unusedImports,
      // @ts-expect-error Type incompatibility in i18n plugin
      '@intlify/vue-i18n': pluginI18n
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      'import-x/no-useless-path-segments': 'error',
      'import-x/no-relative-packages': 'error',
      'unused-imports/no-unused-imports': 'error',
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
          ignoreNodes: ['md-icon', 'v-icon', 'pre', 'code', 'script', 'style'],
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
      'no-restricted-properties': [
        'error',
        {
          object: 'vi',
          property: 'doMock',
          message:
            'Use vi.mock() with vi.hoisted() instead of vi.doMock(). See docs/testing/vitest-patterns.md'
        }
      ],
      // Tests routinely define stub and harness components side-by-side with
      // the system under test and stub emits for documentation only — these
      // production-SFC rules are noise in a test file.
      'vue/one-component-per-file': 'off',
      'vue/no-reserved-component-names': 'off',
      'vue/no-unused-emit-declarations': 'off'
    }
  },
  {
    files: ['**/*.test.ts'],
    plugins: { 'testing-library': testingLibrary },
    rules: {
      'testing-library/prefer-screen-queries': 'error',
      'testing-library/no-container': 'error',
      'testing-library/no-node-access': 'error',
      'testing-library/no-wait-for-multiple-assertions': 'error',
      'testing-library/prefer-find-by': 'error',
      'testing-library/prefer-presence-queries': 'error',
      'testing-library/prefer-user-event': 'error',
      'testing-library/no-debugging-utils': 'error'
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
  },
  {
    files: ['tools/devtools/web/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },

  {
    name: 'comfy/no-new-error-throw',
    files: ['src/**/*.{ts,tsx,vue}'],
    ignores: [
      'src/**/*.d.ts',
      'src/**/*.{test,spec,stories}.{ts,tsx,vue}',
      'src/**/{test,tests,__test__,__tests__,__fixtures__,fixtures}/**',
      'src/**/{generated,vendor}/**',
      'src/__ecs_matrix__/**',
      'src/extensions/core/**',
      'src/scripts/**',
      'src/types/generatedManagerTypes.ts',
      'src/types/vue-shim.d.ts'
    ],
    plugins: {
      comfy: { rules: { 'no-new-error-throw': noNewErrorThrow } }
    },
    rules: {
      'comfy/no-new-error-throw': 'error'
    }
  },

  // Turn off ESLint rules that are already handled by oxlint
  ...oxlint.buildFromOxlintConfigFile(
    path.resolve(import.meta.dirname, '.oxlintrc.json')
  ),
  {
    rules: {
      'import-x/default': 'off',
      'import-x/export': 'off',
      'import-x/namespace': 'off',
      'import-x/no-duplicates': 'off',
      'import-x/consistent-type-specifier-style': 'off'
    }
  },

  // Layer architecture boundary enforcement
  // Layers (bottom to top): base → platform → workbench → renderer
  // Each layer may only import from layers below it.
  // Existing violations are suppressed with eslint-disable comments.
  {
    files: [
      'src/base/**/*.{ts,vue}',
      'src/platform/**/*.{ts,vue}',
      'src/workbench/**/*.{ts,vue}',
      'src/world/**/*.{ts,vue}'
    ],
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/base/**',
              from: [
                './src/platform/**',
                './src/workbench/**',
                './src/renderer/**'
              ],
              message:
                'base/ cannot import from upper layers (violates layer architecture: base → platform → workbench → renderer)'
            },
            {
              target: './src/platform/**',
              from: ['./src/workbench/**', './src/renderer/**'],
              message:
                'platform/ cannot import from upper layers (violates layer architecture: base → platform → workbench → renderer)'
            },
            {
              target: './src/workbench/**',
              from: './src/renderer/**',
              message:
                'workbench/ cannot import from renderer/ (violates layer architecture: base → platform → workbench → renderer)'
            },
            {
              target: './src/world/**',
              from: './src/lib/litegraph/**',
              message:
                'src/world/ must remain free of litegraph dependencies. The world layer owns canonical entity identity and must not depend on litegraph types or values.'
            }
          ]
        }
      ]
    }
  },

  // src/lib/ holds vendored leaf libraries (litegraph). They may import from
  // src/lib/ and from the shared base utilities, but never from an app layer —
  // a vendored library depending on the app that vendors it is a dependency
  // inversion. Reported as a warning while the pre-existing violations are
  // worked off; see the tracking issue before promoting this to 'error'.
  {
    files: ['src/lib/**/*.{ts,vue}'],
    rules: {
      'import-x/no-restricted-paths': [
        'warn',
        {
          zones: [
            {
              target: './src/lib/**',
              from: [
                './src/components/**',
                './src/composables/**',
                './src/extensions/**',
                './src/platform/**',
                './src/renderer/**',
                './src/services/**',
                './src/stores/**',
                './src/views/**',
                './src/workbench/**',
                './src/world/**'
              ],
              message:
                'src/lib/ is vendored leaf code and cannot import from app layers (violates layer architecture: lib → base → platform → workbench → renderer). Invert the dependency: have the app layer pass what it needs in, or move the shared type down into src/lib/ or src/base/.'
            }
          ]
        }
      ]
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
    files: ['apps/website/**/*.{ts,mts,vue}'],
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
  // i18n import enforcement
  // Vue components must use the useI18n() composable, not the global t/d/st/te
  {
    files: ['**/*.vue'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/i18n',
              importNames: ['t', 'd', 'te'],
              message:
                "In Vue components, use `const { t } = useI18n()` instead of importing from '@/i18n'."
            },
            useVirtualListRestriction,
            ...reportErrorRestrictions
          ]
        }
      ]
    }
  },
  // Non-composable .ts files must use the global t/d/te, not useI18n()
  {
    files: ['**/*.ts'],
    ignores: ['**/use[A-Z]*.ts', '**/*.test.ts', 'src/i18n.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'vue-i18n',
              importNames: ['useI18n'],
              message:
                "useI18n() requires Vue setup context. Use `import { t } from '@/i18n'` instead."
            },
            useVirtualListRestriction,
            ...reportErrorRestrictions
          ]
        }
      ]
    }
  },
  // Preserve the useVirtualList ban for files excluded from the useI18n rule.
  {
    files: ['**/use[A-Z]*.ts', '**/*.test.ts', 'src/i18n.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [useVirtualListRestriction, ...reportErrorRestrictions]
        }
      ]
    }
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@vue/test-utils',
              message:
                'Use @testing-library/vue with @testing-library/user-event instead.'
            }
          ]
        }
      ]
    }
  },
  {
    name: 'comfy/enforce-sanitized-html-boundary',
    files: ['src/**/*.vue'],
    rules: {
      'vue/no-v-html': 'error'
    }
  },
  {
    files: ['apps/website/e2e/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              importNames: ['test', 'chromium', 'firefox', 'webkit', 'request'],
              message:
                'Use the blockExternalMedia fixture so website tests cannot access external services.'
            },
            {
              name: 'playwright',
              message: 'Use the blockExternalMedia fixture instead.'
            },
            {
              name: 'vue-i18n',
              importNames: ['useI18n'],
              message: 'useI18n() requires Vue setup context.'
            },
            useVirtualListRestriction,
            ...reportErrorRestrictions
          ]
        }
      ]
    }
  },
  // Browser tests must use comfyPageFixture, not raw @playwright/test test
  {
    files: ['browser_tests/tests/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              importNames: ['test'],
              message:
                "Use `comfyPageFixture as test` from the ComfyPage fixture module instead of raw `test` from '@playwright/test'."
            }
          ],
          patterns: [
            {
              group: ['./**', '../**'],
              message: 'Use the @e2e/ path alias instead of relative imports.'
            },
            {
              group: ['@e2e/helpers', '@e2e/helpers/*'],
              message:
                'browser_tests/helpers/ was removed. Use @e2e/fixtures/utils/, @e2e/fixtures/components/, or @e2e/fixtures/helpers/ instead.'
            }
          ]
        }
      ]
    }
  },
  // Enforce @e2e/ alias — no relative imports in browser_tests (non-spec files)
  {
    files: ['browser_tests/**/*.ts'],
    ignores: ['browser_tests/tests/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./**', '../**'],
              message: 'Use the @e2e/ path alias instead of relative imports.'
            },
            {
              group: ['@e2e/helpers', '@e2e/helpers/*'],
              message:
                'browser_tests/helpers/ was removed. Use @e2e/fixtures/utils/, @e2e/fixtures/components/, or @e2e/fixtures/helpers/ instead.'
            }
          ]
        }
      ]
    }
  }
])
