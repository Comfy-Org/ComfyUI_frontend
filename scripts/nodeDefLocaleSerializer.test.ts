import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import { transformNodeDefV1ToV2 } from '@/schemas/nodeDef/migration'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { escapeI18nMessage } from '@/utils/formatUtil'

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
  it('preserves raw backend text across the collector boundary', () => {
    const backendNodeDef: ComfyNodeDefV1 = {
      name: 'SerializationProbe',
      display_name: 'Live Display Name',
      description: 'Live description',
      category: 'testing',
      python_module: 'nodes',
      input: {
        required: {
          seed: ['INT', { tooltip: 'Live input tooltip' }]
        }
      },
      output: ['IMAGE'],
      output_name: ['image'],
      output_tooltips: ['Live output tooltip'],
      output_node: false
    }

    const crossedBoundary = structuredClone(
      transformNodeDefV1ToV2(backendNodeDef)
    )
    const { nodeDefinitions } = serializeNodeDefLocales([crossedBoundary])

    expect(nodeDefinitions.SerializationProbe).toEqual({
      display_name: 'Live Display Name',
      description: 'Live description',
      inputs: {
        seed: { name: 'seed', tooltip: 'Live input tooltip' }
      },
      outputs: {
        0: { name: 'image', tooltip: 'Live output tooltip' }
      }
    })
  })

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
    if (
      !serializedNode.inputs ||
      !serializedNode.outputs ||
      !serializedNode.description
    ) {
      throw new Error('Expected serialized node labels')
    }
    const serializedInput =
      serializedNode.inputs['Input @ $ {value} | 50%{done}']
    const serializedOutput = serializedNode.outputs['0']
    const serializedWidget = serializedNode.inputs.Runtime_Widget
    if (
      !serializedInput.name ||
      !serializedOutput.name ||
      !serializedWidget.name
    ) {
      throw new Error('Expected serialized field names')
    }

    expect(render(serializedNode.display_name)).toBe(nodeDef.display_name)
    expect(render(serializedNode.description)).toBe(nodeDef.description)
    expect(render(serializedInput.name)).toBe(inputName)
    expect(render(serializedOutput.name)).toBe(outputName)
    expect(render(serializedWidget.name)).toBe(`Widget ${syntax}`)
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

describe('escapeI18nMessage', () => {
  it.for([
    ['plain name'],
    ['@ $ {value} | 50%{done}'],
    ['\\@home'],
    ['cost \\$5'],
    ['a\\{b}'],
    ['back\\\\slash'],
    ['D:\\output\\img.png'],
    ['\\'],
    ['Regex Replace (\\$1)']
  ])('round-trips %j through the vue-i18n compiler', ([raw]) => {
    expect(render(escapeI18nMessage(raw))).toBe(raw)
  })
})
