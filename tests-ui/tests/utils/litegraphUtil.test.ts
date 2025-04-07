import type { IWidget } from '@comfyorg/litegraph/dist/types/widgets'
import { describe, expect, it } from 'vitest'

import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { migrateWidgetsValues } from '@/utils/litegraphUtil'

describe('migrateWidgetsValues', () => {
  it('should remove widget values for forceInput inputs', () => {
    const inputDefs: Record<string, InputSpec> = {
      normalInput: {
        type: 'INT',
        name: 'normalInput'
      },
      forceInputField: {
        type: 'STRING',
        name: 'forceInputField',
        forceInput: true
      },
      anotherNormal: {
        type: 'FLOAT',
        name: 'anotherNormal'
      }
    }

    const widgets: IWidget[] = [
      { name: 'normalInput', type: 'number' },
      { name: 'anotherNormal', type: 'number' }
    ] as unknown as IWidget[]

    const widgetValues = [42, 'dummy value', 3.14]

    const result = migrateWidgetsValues(inputDefs, widgets, widgetValues)
    expect(result).toEqual([42, 3.14])
  })

  it('should return original values if lengths do not match', () => {
    const inputDefs: Record<string, InputSpec> = {
      input1: {
        type: 'INT',
        name: 'input1',
        forceInput: true
      }
    }

    const widgets: IWidget[] = []
    const widgetValues = [42, 'extra value']

    const result = migrateWidgetsValues(inputDefs, widgets, widgetValues)
    expect(result).toEqual(widgetValues)
  })

  it('should handle empty widgets and values', () => {
    const inputDefs: Record<string, InputSpec> = {}
    const widgets: IWidget[] = []
    const widgetValues: any[] = []

    const result = migrateWidgetsValues(inputDefs, widgets, widgetValues)
    expect(result).toEqual([])
  })

  it('should preserve order of non-forceInput widget values', () => {
    const inputDefs: Record<string, InputSpec> = {
      first: {
        type: 'INT',
        name: 'first'
      },
      forced: {
        type: 'STRING',
        name: 'forced',
        forceInput: true
      },
      last: {
        type: 'FLOAT',
        name: 'last'
      }
    }

    const widgets: IWidget[] = [
      { name: 'first', type: 'number' },
      { name: 'last', type: 'number' }
    ] as unknown as IWidget[]

    const widgetValues = ['first value', 'dummy', 'last value']

    const result = migrateWidgetsValues(inputDefs, widgets, widgetValues)
    expect(result).toEqual(['first value', 'last value'])
  })
})
