import { afterEach, describe, expect, it } from 'vitest'

import { LiteGraph } from './litegraph'
import { createWidgetRestorationState } from './LGraphNode'

const originalNamedValuesRestore = LiteGraph.namedValuesRestore

afterEach(() => {
  LiteGraph.namedValuesRestore = originalNamedValuesRestore
})

describe('fallback widget names', () => {
  it('derives named values from a populated fallback list', () => {
    LiteGraph.namedValuesRestore = false

    const restoration = createWidgetRestorationState(
      { widgets_values: [123] },
      ['seed']
    )

    expect(restoration).toStrictEqual({
      positional: [123],
      named: { seed: 123 },
      restoreNamed: true
    })
  })

  it('uses an empty fallback list to activate an existing named register', () => {
    LiteGraph.namedValuesRestore = false

    const restoration = createWidgetRestorationState(
      {
        widgets_values: [123],
        widgets_values_named: { seed: 456 }
      },
      []
    )

    expect(restoration).toStrictEqual({
      positional: [123],
      named: { seed: 456 },
      restoreNamed: true
    })
  })

  it('keeps named restoration disabled when fallback names are absent', () => {
    LiteGraph.namedValuesRestore = false

    const restoration = createWidgetRestorationState({
      widgets_values: [123],
      widgets_values_named: { seed: 456 }
    })

    expect(restoration).toStrictEqual({
      positional: [123],
      named: { seed: 456 },
      restoreNamed: false
    })
  })
})
