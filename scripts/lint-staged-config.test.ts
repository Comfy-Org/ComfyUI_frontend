import { describe, expect, it, vi } from 'vitest'

const chunkOf = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `src/${prefix}${index}.ts`)

/** A fresh module, so one test's chunks never claim commands for the next. */
async function freshConfig() {
  vi.resetModules()
  const { default: lintStaged } = await import('../lint-staged.config')
  return lintStaged
}

describe('lint-staged config', () => {
  it('hands a repo-wide command to the first chunk that asks', async () => {
    const lintStaged = await freshConfig()

    const first = lintStaged(chunkOf('a', 12))
    const second = lintStaged(chunkOf('b', 12))

    expect(first).toContain('pnpm lint')
    expect(first).toContain('pnpm typecheck')
    expect(second).not.toContain('pnpm lint')
    expect(second).not.toContain('pnpm typecheck')
  })

  // Only the chunk holding website files asks for the website typecheck, and
  // an earlier chunk taking the plain one must not swallow it.
  it('still hands out a command no earlier chunk asked for', async () => {
    const lintStaged = await freshConfig()

    lintStaged(chunkOf('a', 12))
    const website = lintStaged([
      ...chunkOf('b', 12),
      'apps/website/src/pages/index.astro'
    ])

    expect(website).toContain('pnpm typecheck:website')
  })

  it('keeps per-file commands scoped to their own chunk', async () => {
    const lintStaged = await freshConfig()

    const first = lintStaged(['src/one.ts'])
    const second = lintStaged(['src/two.ts'])

    expect(first).toContain(
      'pnpm exec eslint --cache --fix --no-warn-ignored "src/one.ts"'
    )
    expect(second).toContain(
      'pnpm exec eslint --cache --fix --no-warn-ignored "src/two.ts"'
    )
  })
})
