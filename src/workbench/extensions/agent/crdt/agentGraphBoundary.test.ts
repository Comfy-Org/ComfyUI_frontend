import { readFileSync, readdirSync } from 'fs'
import { resolve, sep } from 'path'
import { describe, expect, it } from 'vitest'

/**
 * The agent follower must reach the graph through `LGraph`'s public API and
 * the stores' public operations. Reading or writing LiteGraph's private
 * indexes, or deleting a store record so `LGraph.add()` adopts a pre-assigned
 * id, ties agent behaviour to renderer internals that would break if the
 * renderer became reactive, and spreads half-applied state that later code
 * has to remember to roll back.
 *
 * Each entry pins how many times a forbidden token appears in a file today.
 * A count may only go down; delete an entry when it reaches zero. A new use
 * anywhere under `crdt/` fails this test.
 *
 * @see https://linear.app/comfyorg/issue/PM-1293
 */
const FORBIDDEN_TOKENS = [
  // LiteGraph's private node index. Use `graph.getNodeById()` / `graph.add()`.
  '_nodes_by_id',
  // Store-record surgery around `graph.add()` / `graph.remove()`. Store
  // records belong to `graphMutations` (the store leg), not the materializer.
  'nodeStore.deleteNode(',
  'nodeStore.registerNode('
] as const

type ForbiddenToken = (typeof FORBIDDEN_TOKENS)[number]

const RATCHET: Record<string, Partial<Record<ForbiddenToken, number>>> = {
  'agentNodeMaterializer.ts': {
    _nodes_by_id: 5,
    'nodeStore.deleteNode(': 1,
    'nodeStore.registerNode(': 1
  },
  // The store leg owns store records; these are the sanctioned call sites.
  'graphMutations.ts': {
    'nodeStore.deleteNode(': 1,
    'nodeStore.registerNode(': 1
  }
}

function countOccurrences(source: string, token: string): number {
  let count = 0
  let index = source.indexOf(token)
  while (index !== -1) {
    count++
    index = source.indexOf(token, index + token.length)
  }
  return count
}

/** Every `.ts` source under `crdt/`, nested directories included, relative to it. */
function sourceFiles(): readonly string[] {
  return readdirSync(__dirname, { recursive: true, encoding: 'utf-8' })
    .map((name) => name.split(sep).join('/'))
    .filter(
      (name) =>
        name.endsWith('.ts') &&
        !name.endsWith('.test.ts') &&
        !name.endsWith('.d.ts')
    )
}

describe('agent follower stays on the public graph API', () => {
  const files = sourceFiles()

  it('scans the follower sources', () => {
    expect(files).toContain('agentNodeMaterializer.ts')
    expect(files).toContain('graphMutations.ts')
  })

  it.for(files)('%s uses no forbidden token beyond its ratchet', (file) => {
    const source = readFileSync(resolve(__dirname, file), 'utf-8')
    const allowed = RATCHET[file] ?? {}

    for (const token of FORBIDDEN_TOKENS) {
      const observed = countOccurrences(source, token)
      expect(
        observed,
        `${file} uses "${token}" ${observed}x; allowed ${allowed[token] ?? 0}`
      ).toBeLessThanOrEqual(allowed[token] ?? 0)
    }
  })

  it('has no stale ratchet entry', () => {
    for (const [file, tokens] of Object.entries(RATCHET)) {
      expect(files, `${file} no longer exists`).toContain(file)
      const source = readFileSync(resolve(__dirname, file), 'utf-8')
      for (const [token, allowed] of Object.entries(tokens)) {
        const observed = countOccurrences(source, token)
        expect(
          observed,
          `${file}: "${token}" ratchet is ${allowed} but only ${observed} remain; lower it`
        ).toBe(allowed)
      }
    }
  })
})
