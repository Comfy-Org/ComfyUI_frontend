import { describe, expect, it } from 'vitest'

import { lintTargets } from './lintTargets'

describe('lintTargets', () => {
  it.for([
    ['apps/website/src/pages/index.astro', ['eslint']],
    ['src/components/Button.vue', ['oxlint', 'eslint']],
    ['src/components/ui/button/button.variants.ts', ['oxlint', 'eslint']],
    ['src/stores/appStore.test.ts', ['oxlint']],
    ['scripts/lint-unstaged.ts', ['oxlint']],
    ['src/styles.css', []]
  ] as const)('%s is linted by %s', ([fileName, expected]) => {
    const targets = lintTargets([fileName])

    expect(
      (['oxlint', 'eslint'] as const).filter((linter) =>
        targets[linter].includes(fileName)
      )
    ).toEqual(expected)
  })
})
