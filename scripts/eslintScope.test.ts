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
    ['src/stores/appStore.test.ts', false],
    ['src/types/globals.d.ts', false],
    ['scripts/lint-pushed.ts', false],
    ['browser_tests/example.spec.ts', false],
    ['tools/devtools/web/comparerWidget.js', false],
    ['eslint.config.ts', false],
    ['src/styles.css', false]
  ] as const)('%s -> %s', ([fileName, expected]) => {
    expect(isEslintFile(fileName)).toBe(expected)
  })
})
