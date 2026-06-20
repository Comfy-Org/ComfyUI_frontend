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
})
