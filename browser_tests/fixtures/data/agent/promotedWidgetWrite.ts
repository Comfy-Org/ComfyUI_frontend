import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import fs from 'node:fs'
import path from 'node:path'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

export const PROMOTED_WIDGET_SUBGRAPH_TYPE =
  'f2fdebf6-dfaf-43b6-9eb2-7f70613cfdc1'
export const PROMOTED_WIDGET_HOST_NODE_ID = '57'
export const PROMOTED_WIDGET_PROMPT_NODE_ID = '27'
export const PROMOTED_WIDGET_SAMPLER_NODE_ID = '3'
export const PROMOTED_WIDGET_NEW_PROMPT = 'NEW PROMPT'
export const PROMOTED_WIDGET_NEW_STEPS = 12

const ASSET_PATH = path.resolve(
  import.meta.dirname,
  '../../../assets/subgraphs/nested-pack-promoted-values.json'
)

const NODE_WIDGET_ORDERS: WidgetCatalog['types'] = {
  CLIPTextEncode: { widget_order: ['text'] },
  KSampler: {
    widget_order: [
      'seed',
      'control_after_generate',
      'steps',
      'cfg',
      'sampler_name',
      'scheduler',
      'denoise'
    ]
  },
  CLIPLoader: { widget_order: ['clip_name', 'type', 'device'] },
  VAELoader: { widget_order: ['vae_name'] },
  UNETLoader: { widget_order: ['unet_name', 'weight_dtype'] },
  EmptySD3LatentImage: { widget_order: ['width', 'height', 'batch_size'] },
  ModelSamplingAuraFlow: { widget_order: ['shift'] },
  SaveImage: { widget_order: ['filename_prefix'] },
  MarkdownNote: { widget_order: ['text'] },
  ConditioningZeroOut: { widget_order: [] },
  VAEDecode: { widget_order: [] }
}

export function createPromotedWidgetWriteData() {
  const rawAsset: unknown = JSON.parse(fs.readFileSync(ASSET_PATH, 'utf8'))
  const asset = zComfyWorkflow.parse(rawAsset)
  const seed = { ...asset, extra: asset.extra ?? undefined }
  const definition = asset.definitions?.subgraphs.find(
    (subgraph) => subgraph.id === PROMOTED_WIDGET_SUBGRAPH_TYPE
  )
  if (!definition?.inputs)
    throw new Error('Fixture must define promoted subgraph inputs')

  const hostWidgetNames = definition.inputs.map(({ name }) => name)
  const catalog: WidgetCatalog = { types: NODE_WIDGET_ORDERS }
  const hostWidgetValues = definition.inputs.map(({ linkIds, name }) => {
    const linkId = linkIds?.[0]
    if (linkId === undefined)
      throw new Error(`Fixture must link promoted widget ${name}`)
    const node = definition.nodes.find((candidate) =>
      candidate.inputs?.some((input) => input.link === linkId)
    )
    const widgetIndex = node
      ? catalog.types[node.type]?.widget_order.indexOf(name)
      : undefined
    const widgetValues = node?.widgets_values
    const value =
      widgetIndex === undefined ||
      widgetIndex < 0 ||
      !Array.isArray(widgetValues)
        ? undefined
        : widgetValues[widgetIndex]
    if (value === undefined)
      throw new Error(`Fixture must define promoted widget ${name}`)
    return value
  })
  const promptIndex = hostWidgetNames.indexOf('text')
  const stepsIndex = hostWidgetNames.indexOf('steps')
  const interiorPrompt = hostWidgetValues[promptIndex]
  const interiorSteps = hostWidgetValues[stepsIndex]
  if (typeof interiorPrompt !== 'string' || typeof interiorSteps !== 'number')
    throw new Error('Fixture must define prompt and steps promotions')

  const operations: RecordedGraphOperation[] = [
    {
      op: 'set_widget',
      node_id: PROMOTED_WIDGET_HOST_NODE_ID,
      widget: 'text',
      value: PROMOTED_WIDGET_NEW_PROMPT,
      promoted: {
        instance_path: [PROMOTED_WIDGET_HOST_NODE_ID],
        value_index: promptIndex,
        host_widgets_values: hostWidgetValues
      }
    },
    {
      op: 'set_widget',
      node_id: PROMOTED_WIDGET_HOST_NODE_ID,
      widget: 'steps',
      value: PROMOTED_WIDGET_NEW_STEPS,
      promoted: {
        instance_path: [PROMOTED_WIDGET_HOST_NODE_ID],
        value_index: stepsIndex,
        host_widgets_values: hostWidgetValues
      }
    }
  ]

  return {
    seed,
    catalog,
    operations,
    interiorPrompt,
    interiorSteps
  }
}
