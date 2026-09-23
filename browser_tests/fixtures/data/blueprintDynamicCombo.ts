import blueprint from '@e2e/../tools/devtools/subgraphs/test blueprint.json' with { type: 'json' }

import type { GlobalSubgraphData } from '@/scripts/api'

const data = structuredClone(blueprint)
data.nodes[0].inputs[0].name = 'boundary_model'
data.nodes[0].inputs[0].type = 'COMFY_DYNAMICCOMBO_V3'

export const dynamicComboBlueprints: Record<string, GlobalSubgraphData> = {
  dynamicCombo: {
    name: 'Dynamic combo blueprint',
    info: { node_pack: 'ComfyUI_devtools' },
    data: JSON.stringify(data)
  }
}
