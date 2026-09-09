import path from 'node:path'
import { describe, expect, it } from 'vitest'

import lintStaged from './lint-staged.config'

function staged(...fileNames: string[]) {
  return fileNames.map((fileName) => path.join(process.cwd(), fileName))
}

function commandFor(commands: string | string[], tool: string) {
  return [commands].flat().find((command) => command.includes(tool))
}

describe('lintStaged', () => {
  it.for(['eslint', 'oxlint'])(
    'keeps apps/ files out of the root %s invocation',
    (tool) => {
      const command = commandFor(
        lintStaged(staged('src/foo.ts', 'apps/website/src/bar.ts')),
        tool
      )

      expect(command).toContain('"src/foo.ts"')
      expect(command).not.toContain('apps/website/src/bar.ts')
    }
  )

  it('omits the root lint commands entirely when only apps/ code is staged', () => {
    const commands = lintStaged(staged('apps/website/src/bar.ts'))

    expect(commandFor(commands, 'eslint')).toBeUndefined()
    expect(commandFor(commands, 'oxlint')).toBeUndefined()
  })

  it('does not fall back to a whole-repo lint when only apps/ code pushes past the limit', () => {
    const commands = lintStaged(
      staged(
        ...Array.from({ length: 11 }, (_, i) => `apps/website/src/foo${i}.ts`)
      )
    )

    expect(commands).not.toContain('pnpm lint')
    expect(commandFor(commands, 'eslint')).toBeUndefined()
    expect(commandFor(commands, 'oxlint')).toBeUndefined()
  })

  it('still runs stylelint on apps/ vue files, which stylelint globs', () => {
    const command = commandFor(
      lintStaged(staged('apps/website/src/Bar.vue')),
      'stylelint'
    )

    expect(command).toContain('"apps/website/src/Bar.vue"')
  })

  it('still lints file-by-file at exactly the staged-file limit', () => {
    const commands = lintStaged(
      staged(...Array.from({ length: 10 }, (_, i) => `src/foo${i}.ts`))
    )

    expect(commands).not.toContain('pnpm lint')
    expect(commandFor(commands, 'eslint')).toContain('"src/foo9.ts"')
  })

  it('falls back to a whole-repo lint once the staged set grows past the limit', () => {
    const commands = lintStaged(
      staged(...Array.from({ length: 11 }, (_, i) => `src/foo${i}.ts`))
    )

    expect(commands).toContain('pnpm lint')
  })
})
