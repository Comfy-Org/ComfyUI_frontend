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
 * Each entry pins how many times a forbidden operation appears in a file
 * today. A count may only go down; delete an entry when it reaches zero. A
 * new use anywhere under `crdt/` fails this test.
 *
 * FE-2504 is backlog context for eventually deleting the remaining entries,
 * not the architectural contract enforced here.
 *
 * This is a lexical scan, not an AST lint rule: it matches the member-access
 * forms TypeScript offers (`a.b`, `a?.b`, `a['b']`, `a?.['b']`) so a
 * rewrite cannot dodge the ratchet by changing call syntax. Aliasing the
 * store to another name (including `(nodeStore as X).deleteNode`) is the
 * remaining gap, deferred to an ESLint rule.
 *
 * @see https://linear.app/comfyorg/issue/PM-1293
 * @see https://linear.app/comfyorg/issue/FE-2504
 */

/** `receiver.member`, `receiver?.member`, `receiver['member']`, `receiver?.['member']`. */
function memberAccess(receiver: string, member: string): RegExp {
  const dot = String.raw`\??\.\s*${member}(?![$\w])`
  const bracket = String.raw`(?:\?\.)?\s*\[\s*['"]${member}['"]\s*\]`
  // `(?:\s*!)*` accepts any number of chained non-null assertions (`a!!.b`).
  return new RegExp(
    String.raw`\b${receiver}(?:\s*!)*\s*(?:${dot}|${bracket})`,
    'g'
  )
}

const FORBIDDEN_OPERATIONS = {
  // LiteGraph's private node index. Use `graph.getNodeById()` / `graph.add()`.
  _nodes_by_id: /_nodes_by_id/g,
  // Store-record surgery around `graph.add()` / `graph.remove()`. Store
  // records belong to `graphMutations` (the store leg), not the materializer.
  'nodeStore.deleteNode': memberAccess('nodeStore', 'deleteNode'),
  'nodeStore.registerNode': memberAccess('nodeStore', 'registerNode')
} as const satisfies Record<string, RegExp>

type ForbiddenToken = keyof typeof FORBIDDEN_OPERATIONS
const FORBIDDEN_TOKENS = Object.keys(FORBIDDEN_OPERATIONS) as ForbiddenToken[]

const RATCHET: Record<string, Partial<Record<ForbiddenToken, number>>> = {
  'agentNodeMaterializer.ts': {
    _nodes_by_id: 5,
    'nodeStore.deleteNode': 1,
    'nodeStore.registerNode': 1
  },
  // The store leg owns store records; these are the sanctioned call sites.
  'graphMutations.ts': {
    'nodeStore.deleteNode': 1,
    'nodeStore.registerNode': 1
  }
}

function countOccurrences(source: string, token: ForbiddenToken): number {
  return [...source.matchAll(FORBIDDEN_OPERATIONS[token])].length
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

describe('forbidden-operation matcher', () => {
  it.for([
    'nodeStore.deleteNode(node)',
    'nodeStore?.deleteNode(node)',
    'nodeStore!.deleteNode(node)',
    'nodeStore!!.deleteNode(node)',
    'nodeStore.deleteNode!(node)',
    'nodeStore.deleteNode<Node>(node)',
    "nodeStore['deleteNode'](node)",
    "nodeStore!['deleteNode'](node)",
    "nodeStore['deleteNode']!(node)",
    'nodeStore?.["deleteNode"](node)',
    'nodeStore\n  .deleteNode(node)',
    'const fn = nodeStore.deleteNode'
  ])('matches %j', (snippet) => {
    expect(countOccurrences(snippet, 'nodeStore.deleteNode')).toBe(1)
  })

  it.for([
    // A different receiver: the CRDT batch API, not the node store.
    'batch.deleteNode(id)',
    // A different member.
    'nodeStore.deleteNodes(ids)'
  ])('ignores %j', (snippet) => {
    expect(countOccurrences(snippet, 'nodeStore.deleteNode')).toBe(0)
  })
})

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
      for (const token of FORBIDDEN_TOKENS) {
        const allowed = tokens[token]
        if (allowed === undefined) continue
        expect(
          allowed,
          `${file}: remove the zero allowance for "${token}"`
        ).toBeGreaterThan(0)
        const observed = countOccurrences(source, token)
        expect(
          observed,
          `${file}: "${token}" ratchet is ${allowed} but only ${observed} remain; lower it`
        ).toBe(allowed)
      }
    }
  })
})
