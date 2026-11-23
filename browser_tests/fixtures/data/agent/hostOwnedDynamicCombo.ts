import fs from 'node:fs'
import path from 'node:path'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'
import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'

const HOST_OWNED_COMBO_TYPE = 'TestTalkMode'
const HOST_OWNED_INT_TYPE = 'TestTalkInt'
export const HOST_OWNED_COMBO_HOST_ID = '3'
export const HOST_OWNED_COMBO_SAVED_VALUES = ['depth', 2, 4]

const ASSET_PATH = path.resolve(
  import.meta.dirname,
  '../../../assets/agent/subgraph-host-owned-dynamic-combo.json'
)

const comboDef: ComfyNodeDef = {
  name: HOST_OWNED_COMBO_TYPE,
  display_name: 'Test Talk Mode',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['MODEL'],
  output_is_list: [false],
  output_name: ['MODEL'],
  input: {
    required: {
      mode: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'depth',
              inputs: { required: { normalization: ['INT', { default: 2 }] } }
            },
            {
              key: 'two speakers',
              inputs: {
                required: { mask_1: ['MASK', {}], mask_2: ['MASK', {}] }
              }
            }
          ]
        }
      ]
    }
  },
  input_order: { required: ['mode'] }
}

const intDef: ComfyNodeDef = {
  name: HOST_OWNED_INT_TYPE,
  display_name: 'Test Talk Int',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['MODEL'],
  output_is_list: [false],
  output_name: ['MODEL'],
  input: { required: { value: ['INT', { default: 4 }] } },
  input_order: { required: ['value'] }
}

export const hostOwnedDynamicComboDefs: Record<string, ComfyNodeDef> = {
  [HOST_OWNED_COMBO_TYPE]: comboDef,
  [HOST_OWNED_INT_TYPE]: intDef
}

export const hostOwnedDynamicComboCatalog: WidgetCatalog = {
  types: {
    [HOST_OWNED_COMBO_TYPE]: { widget_order: ['mode'] },
    [HOST_OWNED_INT_TYPE]: { widget_order: ['value'] }
  }
}

/**
 * A subgraph host that promotes the dynamic combo `mode` and a plain `value`,
 * so the host itself owns `mode` and the option widget `mode.normalization`.
 */
export function hostOwnedDynamicComboSeed(): WorkflowJSON {
  const raw: unknown = JSON.parse(fs.readFileSync(ASSET_PATH, 'utf8'))
  const asset = zComfyWorkflow.parse(raw)
  return { ...asset, extra: asset.extra ?? undefined }
}
