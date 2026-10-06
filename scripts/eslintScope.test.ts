import { describe, expect, it } from 'vitest'

import { isEslintFile } from './eslintScope'

describe('isEslintFile', () => {
  it.for([
    ['src/components/Button.vue', true],
    ['browser_tests/fixtures/Harness.vue', true],
    ['apps/website/src/pages/index.astro', true],
    ['apps/website/src/pages/index.astro/0.ts', true],
    ['src/components/ui/button/button.variants.ts', true],
    ['apps/website/src/components/ui/button/index.ts', true],
    ['packages/tailwind-utils/src/index.ts', true],
    ['src/locales/en/main.json', true],
    ['src/locales/ja/commands.json', true],
    ['src/locales/zh-TW/settings.json', true],
    ['apps/website/src/locales/zh-CN/main.json', true],
    ['apps/billing-web/src/locales/en/main.json', true],
    ['packages/account-ui/src/locales/en/auth.json', true],
    ['src/locales/en/nodeDefs.json', false],
    ['src/locales/.source-manifest.json', false],
    ['src/locales/.published/en/main.json', false],
    ['apps/website/src/locales/.published/en/main.json', false],
    ['package.json', false],
    ['src/stores/appStore.test.ts', false],
    ['src/types/globals.d.ts', false],
    ['scripts/lint-unstaged.ts', false],
    ['browser_tests/example.spec.ts', false],
    ['tools/devtools/web/comparerWidget.js', false],
    ['eslint.config.ts', false],
    ['src/styles.css', false]
  ] as const)('%s -> %s', ([fileName, expected]) => {
    expect(isEslintFile(fileName)).toBe(expected)
  })
})
