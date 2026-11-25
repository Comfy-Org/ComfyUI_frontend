import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { DefRegistry, PackId } from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'
import { registerTestPack } from '@/platform/nodeApi/v4/__tests__/testPack'

describe('selectors, definitions and colors at their edges', () => {
  let defs: DefRegistry
  let host: ComfyApiHost

  let packId: PackId

  beforeEach(() => {
    const graph = new LGraph()
    const api = createComfyApi({ getGraph: () => graph })
    packId = registerTestPack(api)
    defs = api.comfy.defs
    host = api.host
  })

  it('picks a type by its whole name, not by a name it starts with', () => {
    registerHostType(host.nodeTypeHooks, hostNodeDef('Edges/Sampler'))
    registerHostType(host.nodeTypeHooks, hostNodeDef('Edges/SamplerAdvanced'))
    const applied: string[] = []

    onTestFinished(
      defs.extend(packId, 'Edges/Sampler', (builder) =>
        applied.push(builder.def.type)
      )
    )

    expect(applied).toEqual(['Edges/Sampler'])
  })

  it('says why it refuses a definition, not only that it does', () => {
    registerHostType(host.nodeTypeHooks, hostNodeDef('Edges/Taken'))
    const stop = defs.define(packId, { type: 'Edges/Owned' })

    expect(() => defs.define(packId, { type: 'Edges/Owned' })).toThrow(
      /^define needs a type name no node type has yet/
    )
    expect(() =>
      Reflect.apply(defs.define, defs, [
        packId,
        { type: 'Edges/Other', title: 5 }
      ])
    ).toThrow(/^define needs a title that is text/)
    stop()
  })

  it.for([
    [
      'an instance of a class',
      Object.assign(new (class Definition {})(), { type: 'Edges/Instance' })
    ],
    ['inputs that are null', { type: 'Edges/NullInputs', inputs: null }],
    [
      'an input whose name is not text',
      { type: 'Edges/NumberName', inputs: [{ name: 5, type: 'INT' }] }
    ]
  ] as const)('refuses %s and registers nothing', ([, definition]) => {
    expect(() =>
      Reflect.apply(defs.define, defs, [packId, definition])
    ).toThrow(/^define needs/)
    expect(defs.all()).toEqual([])
  })

  it('gives the table back as it found it when every claim on a type the palette cleared is released', () => {
    const type = 'EDGES_CLEARED'
    LGraphCanvas.link_type_colors[type] = ''
    const first = defs.setTypeColor(type, '#111111')
    first()
    delete LGraphCanvas.link_type_colors[type]
    const second = defs.setTypeColor(type, '#222222')
    LGraphCanvas.link_type_colors[type] = ''
    host.reapplyTypeColors()

    second()

    expect(Object.hasOwn(LGraphCanvas.link_type_colors, type)).toBe(false)
  })
})
