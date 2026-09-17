import { describe, expect, it } from 'vitest'

/**
 * Agent code may *read* graph internals but must not *write* them. Node
 * adoption (record ownership, `_nodes`, `_nodes_by_id`, `node.graph`,
 * `_graphScope`, `_state`) is owned by `LGraph` — see
 * `LGraph.adoptCanonicalNode` and ADR-0034.
 *
 * Reads such as `graph._nodes.filter(...)` or `graph._nodes_by_id[id]` are
 * fine and are not matched here. `batch.deleteNode(...)` on a graph-mutations
 * batch is the sanctioned write path and is not matched either.
 */

const sources = import.meta.glob('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true
})

const FORBIDDEN_WRITES: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'node record ownership write',
    pattern:
      /\b(?:nodeStore|useNodeDataStore\(\))\.(?:deleteNode|registerNode)\(/
  },
  {
    name: '_nodes_by_id assignment',
    pattern: /_nodes_by_id\[[^\]]*\]\s*=[^=]/
  },
  {
    name: '_nodes mutation',
    pattern: /_nodes\.(?:push|splice|pop|shift|unshift)\(/
  },
  { name: 'node.graph assignment', pattern: /\.graph\s*=[^=]/ },
  { name: '_graphScope assignment', pattern: /\._graphScope\s*=[^=]/ },
  { name: '_state assignment', pattern: /\._state\s*=[^=]/ }
]

function productionSources(): Array<[string, string]> {
  return Object.entries(sources).filter(
    ([path]) => !path.endsWith('.test.ts') && !path.includes('__fixtures__')
  )
}

describe('agent crdt code does not write graph internals', () => {
  it('scans at least one production module', () => {
    expect(productionSources().length).toBeGreaterThan(0)
  })

  it.for(productionSources())('%s', ([, text]) => {
    const offenders = text
      .split('\n')
      .flatMap((line, index) =>
        FORBIDDEN_WRITES.filter(({ pattern }) => pattern.test(line)).map(
          ({ name }) => `L${index + 1} ${name}: ${line.trim()}`
        )
      )
    expect(offenders).toEqual([])
  })
})
