import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import { serializeNodeDefLocales } from './nodeDefLocaleSerializer'

function render(message: string): string {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { value: message } }
  })
  return i18n.global.t('value')
}

describe('serializeNodeDefLocales', () => {
  it('escapes compiled fields and preserves raw tooltips', () => {
    const syntax = '@ $ {value} | 50%{done}'
    const inputName = `Input ${syntax}`
    const outputName = `Output ${syntax}`
    const dataType = `TYPE ${syntax}`
    const category = `Category ${syntax}`
    const nodeDef = {
      name: 'Test.Node',
      display_name: `Display ${syntax}`,
      description: `Description ${syntax}`,
      category,
      inputs: {
        input: {
          name: inputName,
          type: dataType,
          tooltip: `Input tooltip ${syntax}`
        }
      },
      outputs: [
        {
          name: outputName,
          type: 'OTHER',
          tooltip: `Output tooltip ${syntax}`
        }
      ]
    }

    const { dataTypes, nodeCategories, nodeDefinitions } =
      serializeNodeDefLocales([nodeDef], {
        'Test.Node': {
          'Runtime.Widget': { name: `Widget ${syntax}` }
        }
      })
    const serializedNode = nodeDefinitions.Test_Node
    const serializedInput =
      serializedNode.inputs['Input @ $ {value} | 50%{done}']
    const serializedOutput = serializedNode.outputs['0']

    expect(render(serializedNode.display_name)).toBe(nodeDef.display_name)
    expect(render(serializedNode.description)).toBe(nodeDef.description)
    expect(render(serializedInput.name)).toBe(inputName)
    expect(render(serializedOutput.name)).toBe(outputName)
    expect(render(serializedNode.inputs.Runtime_Widget.name)).toBe(
      `Widget ${syntax}`
    )
    expect(render(dataTypes[dataType])).toBe(dataType)
    expect(render(nodeCategories[category])).toBe(category)
    expect(serializedInput.tooltip).toBe(nodeDef.inputs.input.tooltip)
    expect(serializedOutput.tooltip).toBe(nodeDef.outputs[0].tooltip)
  })

  it('preserves locale shapes and ordering', () => {
    const { dataTypes, nodeCategories, nodeDefinitions } =
      serializeNodeDefLocales(
        [
          {
            name: 'Z.Node',
            description: '',
            category: 'group/sub.group',
            inputs: {
              omitted: { type: 'Z.TYPE' },
              tooltipOnly: { type: 'A_TYPE', tooltip: 'raw @ tooltip' }
            },
            outputs: [
              { name: 'A_TYPE', type: 'A_TYPE' },
              { name: 'Custom.Output', type: 'Z.TYPE' },
              { tooltip: 'raw output @ tooltip', type: 'Z.TYPE' }
            ]
          },
          {
            name: 'A.Node',
            category: 'group',
            inputs: {},
            outputs: []
          }
        ],
        {
          'Z.Node': {
            'Runtime.Widget': { name: 'Runtime.Label' }
          }
        }
      )

    expect(dataTypes).toEqual({
      A_TYPE: 'A_TYPE',
      Z_TYPE: 'Z.TYPE'
    })
    expect(nodeCategories).toEqual({
      group: 'group',
      sub_group: 'sub.group'
    })
    expect(nodeDefinitions).toEqual({
      A_Node: {
        display_name: 'A.Node',
        description: undefined,
        inputs: undefined,
        outputs: undefined
      },
      Z_Node: {
        display_name: 'Z.Node',
        description: undefined,
        inputs: {
          '': { name: undefined, tooltip: 'raw @ tooltip' },
          Runtime_Widget: { name: 'Runtime.Label' }
        },
        outputs: {
          1: { name: 'Custom.Output', tooltip: undefined },
          2: { name: undefined, tooltip: 'raw output @ tooltip' }
        }
      }
    })
    expect(Object.keys(dataTypes)).toEqual(['A_TYPE', 'Z_TYPE'])
    expect(Object.keys(nodeDefinitions)).toEqual(['A_Node', 'Z_Node'])
  })
})
