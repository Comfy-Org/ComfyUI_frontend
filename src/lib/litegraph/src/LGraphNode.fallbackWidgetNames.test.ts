import { afterEach, describe, expect, it } from 'vitest'

import { LiteGraph } from './litegraph'
import { createWidgetRestorationState } from './LGraphNode'

const originalNamedValuesRestore = LiteGraph.namedValuesRestore

afterEach(() => {
  LiteGraph.namedValuesRestore = originalNamedValuesRestore
})

describe('fallback widget names', () => {
  it.for([
    {
      name: 'a populated fallback list',
      fallbackNames: ['seed'],
      expectedNamed: { seed: 456 }
    },
    {
      name: 'an empty fallback list',
      fallbackNames: [],
      expectedNamed: { seed: 456 }
    }
  ])(
    'enables named restoration from $name while the setting is disabled',
    ({ fallbackNames, expectedNamed }) => {
      LiteGraph.namedValuesRestore = false

      const restoration = createWidgetRestorationState(
        {
          widgets_values: [123],
          widgets_values_named: { seed: 456 }
        },
        fallbackNames
      )

      expect(restoration).toMatchObject({
        named: expectedNamed,
        restoreNamed: true
      })
    }
  )

  it('keeps named restoration disabled when fallback names are absent', () => {
    LiteGraph.namedValuesRestore = false

    const restoration = createWidgetRestorationState({
      widgets_values: [123],
      widgets_values_named: { seed: 456 }
    })

    expect(restoration.restoreNamed).toBe(false)
  })
})
