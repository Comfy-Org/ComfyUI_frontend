import { describe, expect, it, vi } from 'vitest'

function chunkOf(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => `src/${prefix}${index}.ts`)
}

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

  it.for([
    ['browser_tests/example.spec.ts', 'pnpm typecheck:browser'],
    ['apps/website/src/pages/index.astro', 'pnpm typecheck:website']
  ] as const)(
    'still hands out a command no earlier chunk asked for: %s',
    async ([fileName, command]) => {
      const lintStaged = await freshConfig()

      lintStaged(chunkOf('a', 12))
      const later = lintStaged([...chunkOf('b', 12), fileName])

      expect(later).toContain(command)
    }
  )

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
