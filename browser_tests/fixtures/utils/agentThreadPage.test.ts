// @vitest-environment node
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { globSync } from 'glob'
import type { Node, ObjectLiteralExpression } from 'typescript'
import {
  ScriptTarget,
  createSourceFile,
  forEachChild,
  isIdentifier,
  isObjectLiteralExpression,
  isStringLiteral
} from 'typescript'
import { describe, expect, it } from 'vitest'

import { zAgentThreads } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { emptyAgentThreadPage } from '@e2e/fixtures/utils/agentThreadPage'

// `new URL(...).pathname` is a URL path, not a filesystem path: spaces and
// non-ASCII stay percent-encoded, and on Windows the drive letter keeps a
// leading slash. `globSync` answers `[]` for a `cwd` that does not exist
// instead of throwing, so getting this wrong makes the scan below pass while
// reading nothing. Same conversion as `fixtures/data/agent/agentConversation.ts`.
const browserTestsDir = fileURLToPath(new URL('../..', import.meta.url))

function specFiles(): string[] {
  return globSync('**/*.ts', { cwd: browserTestsDir, absolute: true })
}

/**
 * Object literals in `source` that carry a `threads` property and no
 * `pagination` beside it — the exact shape the ten drifted mocks had.
 *
 * Parsed rather than matched against a regex. The regex this replaced
 * (`/jsonRoute\(\s*\{\s*threads:/`) was simultaneously too narrow and too
 * broad: it missed `jsonRoute({ pagination, threads: [] })`, a hoisted
 * `const body = { threads: [] }` and `JSON.stringify({ threads: [] })`, and it
 * flagged a contract-complete `jsonRoute({ threads: [thread], pagination })`
 * that `emptyAgentThreadPage()` cannot express. It also had no way to tell an
 * object literal from the same characters inside a comment or a string.
 *
 * Structural typing is the first line of defence and this is the backstop:
 * a body annotated `AgentThreadListResponse` cannot drift past `vue-tsc`, but
 * an untyped inline literal can, and that is what every drifted mock was.
 */
function incompleteThreadPages(fileName: string, source: string): number[] {
  const parsed = createSourceFile(fileName, source, ScriptTarget.Latest, true)
  const lines: number[] = []
  const propertyNames = (node: ObjectLiteralExpression): string[] =>
    node.properties.flatMap((property) =>
      property.name !== undefined &&
      (isIdentifier(property.name) || isStringLiteral(property.name))
        ? [property.name.text]
        : []
    )
  const visit = (node: Node): void => {
    if (isObjectLiteralExpression(node)) {
      const names = propertyNames(node)
      if (names.includes('threads') && !names.includes('pagination'))
        lines.push(
          parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1
        )
    }
    forEachChild(node, visit)
  }
  visit(parsed)
  return lines
}

describe('emptyAgentThreadPage', () => {
  it('satisfies the contract the panel parses the response against', () => {
    // `zAgentThreads` is what `listThreads()` actually parses with — the
    // generated `zAgentThreadListResponse` under an app-owned `.passthrough()`
    // wrapper. Pinned here rather than the generated schema so a future local
    // narrowing cannot drift away from this test.
    expect(() => zAgentThreads.parse(emptyAgentThreadPage())).not.toThrow()
  })

  it('rejects the shape the mocks had drifted to', () => {
    // Derived by deleting the field the drifted mocks were missing, rather
    // than written as a literal: the scan below forbids exactly that literal
    // and holds this file to the same rule as every other.
    const drifted: Record<string, unknown> = { ...emptyAgentThreadPage() }
    delete drifted.pagination
    expect(() => zAgentThreads.parse(drifted)).toThrow()
  })

  it('is the only way browser_tests builds an empty thread page', () => {
    const scanned = specFiles().map((path) => relative(browserTestsDir, path))
    // An empty or misdirected scan is the way this guard fails open, so it
    // has to prove it read the tree it names — not merely that it read
    // something.
    expect(scanned).toContain('fixtures/utils/agentThreadPage.test.ts')
    expect(scanned.length).toBeGreaterThan(1)

    const offenders = specFiles()
      .flatMap((path) => {
        const source = readFileSync(path, 'utf8')
        // Parsing every file in browser_tests costs seconds; the substring is
        // a necessary condition for a `threads` property, so skipping without
        // it cannot hide an offender.
        if (!source.includes('threads')) return []
        return incompleteThreadPages(path, source).map(
          (line) => `${relative(browserTestsDir, path)}:${line}`
        )
      })
      .sort()
    expect(offenders).toEqual([])
  })
})
