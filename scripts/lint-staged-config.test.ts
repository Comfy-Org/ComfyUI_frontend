import { describe, expect, it, vi } from 'vitest'

function chunkOf(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => `src/${prefix}${index}.ts`)
}

async function freshConfig() {
  vi.resetModules()
  const { default: lintStaged } = await import('../lint-staged.config')
  return lintStaged
}

const typecheckCommandsOf = (commands: string | string[]) =>
  [commands].flat().filter((command) => command.startsWith('pnpm typecheck'))

describe('lint-staged config', () => {
  it('hands a repo-wide command to the first chunk that asks', async () => {
    const lintStaged = await freshConfig()

    const first = lintStaged(chunkOf('a', 12))
    const second = lintStaged(chunkOf('b', 12))

    expect(first).toContain('pnpm typecheck:app')
    expect(second).not.toContain('pnpm typecheck:app')
  })

  it('lints staged files individually however many there are', async () => {
    const lintStaged = await freshConfig()

    const commands = [lintStaged(chunkOf('a', 12))].flat()

    expect(commands).not.toContain('pnpm lint')
    expect(commands.some((command) => command.includes('eslint '))).toBe(true)
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

  it.for([
    ['src/stores/appStore.ts', ['pnpm typecheck:app']],
    ['vite.config.mts', ['pnpm typecheck:app']],
    ['browser_tests/example.spec.ts', ['pnpm typecheck:browser']],
    ['scripts/check-frozen-dirs.ts', ['pnpm typecheck:scripts']],
    ['tools/eslint-plugins/astro.ts', ['pnpm typecheck:tools']],
    ['apps/billing-web/src/main.ts', ['pnpm typecheck:billing-web']],
    [
      'packages/account-core/src/index.ts',
      ['pnpm typecheck:app', 'pnpm typecheck:account-core']
    ],
    ['packages/design-system/src/index.ts', ['pnpm typecheck:app']],
    ['src/styles.css', []]
  ] as const)(
    'typechecks only the programs that own %s',
    async ([fileName, expected]) => {
      const lintStaged = await freshConfig()

      expect(typecheckCommandsOf(lintStaged([fileName]))).toEqual(expected)
    }
  )

  it('keeps per-file commands scoped to their own chunk', async () => {
    const lintStaged = await freshConfig()

    const first = lintStaged(['src/one.ts'])
    const second = lintStaged(['src/two.ts'])

    expect(first).toContain(`${stagedEslint} "src/one.ts"`)
    expect(second).toContain(`${stagedEslint} "src/two.ts"`)
  })
})

const stagedEslint =
  "pnpm exec eslint --cache --cache-strategy content --concurrency auto --fix --no-warn-ignored --rule 'better-tailwindcss/enforce-canonical-classes: off' --report-unused-disable-directives-severity off"
