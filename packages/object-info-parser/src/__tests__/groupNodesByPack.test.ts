import { describe, expect, it } from 'vitest'

import { groupNodesByPack } from '../helpers/groupNodesByPack'
import type { ComfyNodeDef } from '../schemas/nodeDefSchema'

function makeNodeDef(
  name: string,
  pythonModule: string,
  displayName = name
): ComfyNodeDef {
  return {
    name,
    display_name: displayName,
    description: '',
    category: 'test',
    output_node: false,
    python_module: pythonModule
  }
}

describe('groupNodesByPack', () => {
  it('excludes core nodes and groups custom nodes by pack id', () => {
    const grouped = groupNodesByPack({
      CoreNode: makeNodeDef('CoreNode', 'nodes'),
      ImpactA: makeNodeDef(
        'ImpactA',
        'custom_nodes.comfyui-impact-pack.nodes',
        'Impact A'
      ),
      ImpactB: makeNodeDef(
        'ImpactB',
        'custom_nodes.comfyui-impact-pack.nodes',
        'Impact B'
      ),
      AuxNode: makeNodeDef(
        'AuxNode',
        'custom_nodes.comfyui-controlnet-aux.nodes',
        'Aux Node'
      )
    })

    expect(grouped).toHaveLength(2)
    expect(grouped.map((pack) => pack.id)).toEqual([
      'comfyui-controlnet-aux',
      'comfyui-impact-pack'
    ])
    expect(
      grouped.find((pack) => pack.id === 'comfyui-impact-pack')?.nodes
    ).toHaveLength(2)
    expect(
      grouped.find((pack) => pack.id === 'comfyui-controlnet-aux')?.nodes
    ).toHaveLength(1)
  })

  it('slugifies pack ids to lowercase, hyphen-only URL slugs', () => {
    const grouped = groupNodesByPack({
      A: makeNodeDef('A', 'custom_nodes.ComfyUI-Crystools.nodes'),
      B: makeNodeDef('B', 'custom_nodes.basic_data_handling.nodes'),
      C: makeNodeDef('C', 'custom_nodes.ComfyUI_yanc.nodes')
    })

    expect(grouped.map((pack) => pack.id)).toEqual([
      'basic-data-handling',
      'comfyui-crystools',
      'comfyui-yanc'
    ])
  })

  it('preserves the raw upstream id for registry lookups', () => {
    const grouped = groupNodesByPack({
      A: makeNodeDef('A', 'custom_nodes.ComfyUI-Crystools.nodes'),
      B: makeNodeDef('B', 'custom_nodes.basic_data_handling.nodes')
    })

    expect(grouped.find((pack) => pack.id === 'comfyui-crystools')?.rawId).toBe(
      'ComfyUI-Crystools'
    )
    expect(
      grouped.find((pack) => pack.id === 'basic-data-handling')?.rawId
    ).toBe('basic_data_handling')
  })

  it('merges packs whose raw ids slugify to the same URL slug', () => {
    const grouped = groupNodesByPack({
      QwenA: makeNodeDef('QwenA', 'custom_nodes.ComfyUI-QwenVL.nodes'),
      QwenB: makeNodeDef('QwenB', 'custom_nodes.ComfyUI_QwenVL.nodes')
    })

    expect(grouped).toHaveLength(1)
    expect(grouped[0].id).toBe('comfyui-qwenvl')
    expect(grouped[0].nodes.map((n) => n.className).sort()).toEqual([
      'QwenA',
      'QwenB'
    ])
  })

  it('strips version suffix before slugifying', () => {
    const grouped = groupNodesByPack({
      A: makeNodeDef('A', 'custom_nodes.ComfyUI_yanc@1_0_3.nodes')
    })

    expect(grouped).toHaveLength(1)
    expect(grouped[0].id).toBe('comfyui-yanc')
    expect(grouped[0].rawId).toBe('ComfyUI_yanc')
  })
})
