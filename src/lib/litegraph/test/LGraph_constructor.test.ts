import { describe } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'

import { dirtyTest } from './testExtensions'

describe('LGraph (constructor only)', () => {
  dirtyTest(
    'Matches previous snapshot',
    ({ expect, minimalSerialisableGraph, basicSerialisableGraph }) => {
      const minLGraph = new LGraph(minimalSerialisableGraph)
      expect(minLGraph).toMatchSnapshot('minLGraph')

      const basicLGraph = new LGraph(basicSerialisableGraph)
      expect(basicLGraph).toMatchSnapshot('basicLGraph')
    }
  )
})
