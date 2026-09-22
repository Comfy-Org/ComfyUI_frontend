import type { GraphTopology } from '@e2e/fixtures/helpers/SubgraphHelper'

export const nestedSubgraphTopologies = {
  root: {
    nodes: ['10', '8', '9'],
    links: [
      ['10', 0, '8', 0],
      ['10', 1, '8', 1],
      ['8', 0, '9', 0]
    ]
  },
  outer: {
    nodes: ['11', '3', '6'],
    links: [
      ['11', 0, '3', 2],
      ['11', 1, '3', 3],
      ['11', 2, '3', 0],
      ['11', 3, '6', 0],
      ['11', 4, '-20', 1],
      ['3', 0, '-20', 0],
      ['6', 0, '3', 1]
    ]
  },
  inner: {
    nodes: ['4', '5', '7'],
    links: [
      ['4', 0, '-20', 2],
      ['4', 1, '-20', 3],
      ['4', 1, '7', 0],
      ['4', 2, '-20', 4],
      ['5', 0, '-20', 1],
      ['7', 0, '-20', 0]
    ]
  }
} satisfies Record<'root' | 'outer' | 'inner', GraphTopology>

export const outerSubgraphBreadcrumbId =
  'subgraph-8beb610f-ddd1-4489-ae0d-2f732a4042ae'
