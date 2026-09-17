import { describe, expect, it } from 'vitest'

/**
 * Agent code may *read* graph internals but must not *write* them. Node
 * adoption (record ownership, `_nodes`, `_nodes_by_id`, `node.graph`,
 * `_graphScope`, `_state`) is owned by `LGraph` — see
 * `LGraph.adoptCanonicalNode` and the ECS-0008 rule that entity records are
 * owned by their stores and graph systems, not by workbench extensions.
 *
 * Reads such as `graph._nodes.filter(...)` or `graph._nodes_by_id[id]` are
 * fine and are not matched here. `batch.deleteNode(...)` on a graph-mutations
 * batch is the sanctioned write path and is not matched either.
 */

const sources = import.meta.glob<string>('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true
})

// `=[^=]` matches assignment but not `==`/`===`; the optional prefix also
// catches logical compound assignment (`graph._nodes ??= []`, `node.graph ||= g`).
const ASSIGN = String.raw`\s*(?:\?\?|\|\||&&)?=[^=]`

const FORBIDDEN_WRITES: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'node record ownership write',
    pattern:
      /\b(?:nodeStore|useNodeDataStore\(\))\.(?:deleteNode|registerNode)\(/
  },
  {
    name: '_nodes_by_id assignment',
    pattern: new RegExp(
      String.raw`\b_nodes_by_id(?:\[[^\]]*\]|\.\w+)?${ASSIGN}`
    )
  },
  {
    name: '_nodes assignment',
    pattern: new RegExp(String.raw`\b_nodes(?:\[[^\]]*\])?${ASSIGN}`)
  },
  {
    name: '_nodes mutation',
    pattern: /\b_nodes\.(?:push|splice|pop|shift|unshift|length\s*=[^=])/
  },
  {
    name: 'node.graph assignment',
    pattern: new RegExp(String.raw`\.graph${ASSIGN}`)
  },
  {
    name: '_graphScope assignment',
    pattern: new RegExp(String.raw`\._graphScope${ASSIGN}`)
  },
  {
    name: '_state assignment',
    pattern: new RegExp(String.raw`\._state${ASSIGN}`)
  }
]

function offendersIn(text: string): string[] {
  return text
    .split('\n')
    .flatMap((line, index) =>
      FORBIDDEN_WRITES.filter(({ pattern }) => pattern.test(line)).map(
        ({ name }) => `L${index + 1} ${name}: ${line.trim()}`
      )
    )
}

function productionSources(): Array<[string, string]> {
  return Object.entries(sources).filter(
    ([path]) => !path.endsWith('.test.ts') && !path.includes('__fixtures__')
  )
}

describe('graph internals boundary patterns', () => {
  it.for([
    ['graph._nodes = []', '_nodes assignment'],
    ['graph._nodes[0] = node', '_nodes assignment'],
    ['graph._nodes ??= []', '_nodes assignment'],
    ['graph._nodes.length = 0', '_nodes mutation'],
    ['graph._nodes.push(node)', '_nodes mutation'],
    ['graph._nodes.splice(index, 1)', '_nodes mutation'],
    ['graph._nodes_by_id = {}', '_nodes_by_id assignment'],
    ['graph._nodes_by_id[id] = node', '_nodes_by_id assignment'],
    ['graph._nodes_by_id.abc = node', '_nodes_by_id assignment'],
    [
      'delete graph._nodes_by_id[id]; graph._nodes_by_id[id]= n',
      '_nodes_by_id assignment'
    ],
    ['node.graph = graph', 'node.graph assignment'],
    ['node.graph ||= graph', 'node.graph assignment'],
    ['node._graphScope = scope', '_graphScope assignment'],
    ['node._state = record', '_state assignment'],
    ['nodeStore.deleteNode(id)', 'node record ownership write'],
    ['useNodeDataStore().registerNode(record)', 'node record ownership write']
  ] as const)('rejects `%s`', ([line, name]) => {
    expect(offendersIn(line)).toEqual([`L1 ${name}: ${line}`])
  })

  it.for([
    'const live = graph._nodes.filter((node) => node.type === type)',
    'const node = graph._nodes_by_id[id]',
    'if (graph._nodes.length === 0) return',
    'if (node.graph === graph) return',
    'if (node.graph !== null) continue',
    'const count = graph._nodes.length',
    'batch.deleteNode(id)',
    'const nodes = [...graph._nodes]',
    'graph._nodes.forEach(visit)',
    'expect(graph._nodes_by_id[id]).toBe(node)'
  ])('allows `%s`', (line) => {
    expect(offendersIn(line)).toEqual([])
  })
})

describe('agent crdt code does not write graph internals', () => {
  it('scans at least one production module', () => {
    expect(productionSources().length).toBeGreaterThan(0)
  })

  it.for(productionSources())('%s', ([, text]) => {
    expect(offendersIn(text)).toEqual([])
  })
})
