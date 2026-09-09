/**
 * Every destination the conversion skill names must exist.
 *
 * The skill is the single artifact steering every conversion, and a destination
 * that does not exist is worse than a missing capability: the agent writes
 * confident code against it, every static check passes, and the failure only
 * appears when a user loads the pack. This has already cost more converted files
 * than absent API has — the table routed drawing at `node.decorations.set`,
 * widget invalidation at `setOptions` (the member is `setOption`), and polling
 * at `node.onChange`, none of which ship.
 *
 * Only the *destination* column is checked. The left column names the legacy
 * API on purpose, and planned-but-unshipped capabilities are exactly what must
 * not be recommended.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { API_MEMBERS } from './apiSurface'

const SKILL = join(
  import.meta.dirname,
  '../../../.claude/skills/converting-custom-nodes/SKILL.md'
)

/**
 * Prose that reads as a call but names no member.
 *
 * `resolve` and `mount` are contract keys the pack implements rather than
 * members it calls; the rest are English.
 */
const NOT_MEMBERS = new Set(['delete', 'punt', 'remove', 'the', 'it'])

/** The middle column of every mapping row, which is where destinations live. */
function destinationCells(markdown: string): string[] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('|') && !/^\|[\s:|-]+\|$/.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 4 && !/^`?Old`?$/.test(cells[1]))
    .map((cells) => cells[2])
}

/** Members named as calls (`foo(`) or accesses (`.foo`) inside code spans. */
function membersIn(cell: string): string[] {
  const code = [...cell.matchAll(/`([^`]+)`/g)]
    .map((m) => m[1])
    // A file path's extension is not a member access.
    .filter((span) => !span.includes('/'))
    .join(' ')
  return [
    ...[...code.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)].map((m) => m[1]),
    ...[...code.matchAll(/\.([A-Za-z_]\w*)\b/g)].map((m) => m[1])
  ].filter((name) => !NOT_MEMBERS.has(name))
}

describe('the skill only routes to API that exists', () => {
  const markdown = readFileSync(SKILL, 'utf8')

  it('finds the mapping table, so a passing run means something', () => {
    // Without this, a rename that breaks the parse would make every assertion
    // below vacuously true — the check would report success having read nothing.
    expect(destinationCells(markdown).length).toBeGreaterThan(15)
  })

  it('names no member the published API does not define', () => {
    const unknown = destinationCells(markdown)
      .flatMap((cell) => membersIn(cell).map((name) => ({ cell, name })))
      .filter(({ name }) => !API_MEMBERS.has(name))

    expect(
      unknown.map(({ name, cell }) => `${name} — routed by: ${cell}`)
    ).toEqual([])
  })
})
