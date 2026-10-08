import { describe, expect, it } from 'vitest'

import { createDefaultLight } from '@/extensions/core/lightInfo/types'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

import { useLightInfoWidget } from './useLightInfoWidget'

function addEditorWidget(defaultValue: unknown) {
  const node = new LGraphNode('CreateLightInfo')
  const widget = useLightInfoWidget()(node, {
    type: 'LIGHT_INFO_PREVIEW',
    name: 'editor_state',
    default: defaultValue
  } as InputSpec)
  return { node, widget }
}

describe('useLightInfoWidget', () => {
  it('adds a lightinfo widget seeded with a copy of the spec default', () => {
    const lights = [createDefaultLight('spot')]

    const { node, widget } = addEditorWidget(lights)

    expect(node.widgets).toEqual([widget])
    expect(widget.type).toBe('lightinfo')
    expect(widget.name).toBe('editor_state')
    expect(widget.value).toEqual(lights)
    expect(widget.value).not.toBe(lights)
    expect(widget.options).toMatchObject({ hideInPanel: true })
  })

  it.for([
    { source: 'no default', defaultValue: undefined },
    { source: 'an empty default', defaultValue: [] },
    {
      source: 'only invalid entries',
      defaultValue: [{ type: 'laser' }, 'junk']
    }
  ])('seeds an empty light list from $source', ({ defaultValue }) => {
    const { widget } = addEditorWidget(defaultValue)

    expect(widget.value).toEqual([])
  })
})
