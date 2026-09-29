import { describe, expect, it } from 'vitest'

import type { Baseline } from './check-import-cycles'
import {
  baselineViolations,
  cyclicEdges,
  diffBaseline,
  formatBaseline,
  graphFromCruise,
  shortestCyclePath,
  stronglyConnectedComponents
} from './check-import-cycles'

type Edges = Record<string, string[]>

function graph(edges: Edges) {
  return new Map(
    Object.entries(edges).map(([from, to]) => [from, new Set(to)] as const)
  )
}

describe('cyclicEdges', () => {
  it.for<{ name: string; edges: Edges; expected: Baseline }>([
    {
      name: 'acyclic graph has no cyclic edges',
      edges: { a: ['b'], b: ['c'], c: [] },
      expected: {}
    },
    {
      name: 'two-node cycle reports both directions',
      edges: { a: ['b'], b: ['a'] },
      expected: { a: ['b'], b: ['a'] }
    },
    {
      name: 'edges between distinct components are excluded',
      edges: { a: ['b', 'c'], b: ['a'], c: ['d'], d: ['c'] },
      expected: { a: ['b'], b: ['a'], c: ['d'], d: ['c'] }
    },
    {
      name: 'longer cycle keeps every edge on it and drops the exit edge',
      edges: { a: ['b'], b: ['c'], c: ['a', 'd'], d: [] },
      expected: { a: ['b'], b: ['c'], c: ['a'] }
    },
    {
      name: 'cross-edges into completed components stay outside later cycles',
      edges: {
        a: ['b'],
        b: ['a'],
        c: ['a', 'd'],
        d: ['c'],
        e: ['c', 'f'],
        f: ['e']
      },
      expected: {
        a: ['b'],
        b: ['a'],
        c: ['d'],
        d: ['c'],
        e: ['f'],
        f: ['e']
      }
    }
  ])('$name', ({ edges, expected }) => {
    expect(cyclicEdges(graph(edges))).toEqual(expected)
  })

  it('is independent of module iteration order', () => {
    const forward = graph({ a: ['b'], b: ['c'], c: ['a'], d: ['a'] })
    const reverse = graph({ d: ['a'], c: ['a'], b: ['c'], a: ['b'] })
    expect(cyclicEdges(reverse)).toEqual(cyclicEdges(forward))
  })
})

describe('stronglyConnectedComponents', () => {
  it('handles a deep chain without recursion', () => {
    const edges: Record<string, string[]> = {}
    for (let i = 0; i < 50_000; i++) edges[`m${i}`] = [`m${i + 1}`]
    edges.m50000 = ['m0']
    expect(stronglyConnectedComponents(graph(edges))).toHaveLength(1)
  })
})

describe('diffBaseline', () => {
  it.for<{
    name: string
    current: Baseline
    baseline: Baseline
    expected: ReturnType<typeof diffBaseline>
  }>([
    {
      name: 'unchanged',
      current: { a: ['b'], b: ['a'] },
      baseline: { a: ['b'], b: ['a'] },
      expected: { added: [], stale: [] }
    },
    {
      name: 'new edge from a known module and a new module',
      current: { a: ['b', 'c'], b: ['a'], c: ['a'] },
      baseline: { a: ['b'], b: ['a'] },
      expected: {
        added: [
          ['a', 'c'],
          ['c', 'a']
        ],
        stale: []
      }
    },
    {
      name: 'removed edges are stale',
      current: { a: ['b'], b: ['a'] },
      baseline: { a: ['b', 'c'], b: ['a'], c: ['a'] },
      expected: {
        added: [],
        stale: [
          ['a', 'c'],
          ['c', 'a']
        ]
      }
    }
  ])('$name', ({ current, baseline, expected }) => {
    expect(diffBaseline(current, baseline)).toEqual(expected)
  })
})

describe('baselineViolations', () => {
  it.for<{
    name: string
    edges: Edges
    baseline: Baseline
    expected: string[]
  }>([
    {
      name: 'unchanged baseline passes',
      edges: { a: ['b'], b: ['a'] },
      baseline: { a: ['b'], b: ['a'] },
      expected: []
    },
    {
      name: 'new cycle reports the cycle it closes',
      edges: { a: ['b'], b: ['a'] },
      baseline: {},
      expected: [expect.stringContaining('a\n    -> b\n    -> a')]
    },
    {
      name: 'stale entry fails',
      edges: { a: ['b'], b: [] },
      baseline: { a: ['b'], b: ['a'] },
      expected: [expect.stringContaining('no longer cyclic')]
    }
  ])('$name', ({ edges, baseline, expected }) => {
    expect(baselineViolations(graph(edges), baseline)).toEqual(expected)
  })
})

describe('formatBaseline', () => {
  it('writes JSON that parses back to the same baseline', () => {
    const baseline = {
      'src/a"quoted.ts': ['src/b.ts'],
      'src/b.ts': ['src/a"quoted.ts']
    }
    expect(JSON.parse(formatBaseline(baseline))).toEqual(baseline)
  })
})

describe('shortestCyclePath', () => {
  it('returns the shortest closed walk through the edge', () => {
    const g = graph({
      a: ['b'],
      b: ['c', 'x'],
      c: ['d'],
      d: ['a'],
      x: ['a']
    })
    expect(shortestCyclePath(g, 'a', 'b')).toEqual(['a', 'b', 'x', 'a'])
  })

  it('returns an empty path when the edge is not on a cycle', () => {
    expect(shortestCyclePath(graph({ a: ['b'], b: [] }), 'a', 'b')).toEqual([])
  })
})

describe('graphFromCruise', () => {
  it('keeps only src modules and drops self and external edges', () => {
    const result = graphFromCruise([
      {
        source: 'src/a.ts',
        dependencies: [
          { resolved: 'src/b.ts' },
          { resolved: 'src/a.ts' },
          { resolved: 'node_modules/vue/index.js' }
        ]
      },
      { source: 'src/b.ts', dependencies: [{ resolved: 'src/a.ts' }] },
      { source: 'packages/x/index.ts', dependencies: [] }
    ])
    expect(result).toEqual(
      graph({ 'src/a.ts': ['src/b.ts'], 'src/b.ts': ['src/a.ts'] })
    )
  })
})
