import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { readTracked, trackedFiles } from './trackedFiles'

const NETWORK_GUARD = /vitest\.(?:network\.)?setup/
const TIMER_GUARD = /vitest\.timer\.setup/

const CONFIGS_WITHOUT_TIMER_GUARD = [
  'apps/billing-web/vitest.config.ts',
  'packages/billing-contract/vitest.config.ts',
  'packages/test-utils/vitest.config.ts',
  'vitest.matrix.config.mts'
]

function stringLiterals(file: string, source: string): string {
  const literals: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node)) literals.push(node.text)
    ts.forEachChild(node, visit)
  }
  visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest))
  return literals.join('\n')
}

function vitestConfigs(): { file: string; source: string }[] {
  return trackedFiles(
    '**/vite.config.*',
    '**/vitest.config.*',
    'vite.config.*',
    'vitest.*.config.*'
  )
    .map((file) => ({ file, text: readTracked(file) }))
    .filter(({ text }) => text.includes('setupFiles'))
    .map(({ file, text }) => ({ file, source: stringLiterals(file, text) }))
}

describe('Vitest isolation guards', () => {
  it('loads the network guard in every Vitest config', () => {
    const unguarded = vitestConfigs()
      .filter(({ source }) => !NETWORK_GUARD.test(source))
      .map(({ file }) => file)

    expect(unguarded).toEqual([])
  })

  it('loads the timer guard everywhere except the known exceptions', () => {
    const withoutTimers = vitestConfigs()
      .filter(({ source }) => !TIMER_GUARD.test(source))
      .map(({ file }) => file)
      .toSorted()

    expect(withoutTimers).toEqual(CONFIGS_WITHOUT_TIMER_GUARD)
  })
})
