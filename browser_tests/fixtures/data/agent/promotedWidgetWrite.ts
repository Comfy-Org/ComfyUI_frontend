import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import fs from 'node:fs'
import path from 'node:path'
import * as Y from 'yjs'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

export const PROMOTED_WIDGET_WORKFLOW_NAME =
  'subgraphs/nested-pack-promoted-values'
export const PROMOTED_WIDGET_WORKFLOW_LABEL = path.basename(
  PROMOTED_WIDGET_WORKFLOW_NAME
)
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

function fixtureData() {
  const rawAsset: unknown = JSON.parse(fs.readFileSync(ASSET_PATH, 'utf8'))
  const asset = zComfyWorkflow.parse(rawAsset)
  const definition = asset.definitions?.subgraphs.find(
    (subgraph) => subgraph.id === PROMOTED_WIDGET_SUBGRAPH_TYPE
  )
  if (!definition?.inputs)
    throw new Error('Fixture must define promoted subgraph inputs')
  const hostWidgetNames = definition.inputs.map(({ name }) => name)
  const catalog: WidgetCatalog = {
    types: {
      ...NODE_WIDGET_ORDERS,
      [PROMOTED_WIDGET_SUBGRAPH_TYPE]: { widget_order: hostWidgetNames }
    }
  }
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
  const widthIndex = hostWidgetNames.indexOf('width')
  const stepsIndex = hostWidgetNames.indexOf('steps')
  const interiorPrompt = hostWidgetValues[promptIndex]
  const interiorWidth = hostWidgetValues[widthIndex]
  const interiorSteps = hostWidgetValues[stepsIndex]
  if (
    typeof interiorPrompt !== 'string' ||
    typeof interiorWidth !== 'number' ||
    typeof interiorSteps !== 'number'
  )
    throw new Error('Fixture must define prompt, width, and steps promotions')

  return {
    asset,
    catalog,
    hostWidgetValues,
    promptIndex,
    stepsIndex,
    interiorPrompt,
    interiorWidth,
    interiorSteps
  }
}

export function createPromotedWidgetWriteData() {
  const data = fixtureData()
  const doc = mint(
    { ...data.asset, extra: data.asset.extra ?? undefined },
    data.catalog
  )
  const fullState = Y.encodeStateAsUpdate(doc)
  const vectorBefore = Y.encodeStateVector(doc)
  const ops: Op[] = [
    {
      op_id: 'op-1',
      actor: 'agent:test:1',
      base_version: 1,
      stamp: [1, 'agent:test:1'],
      op: 'set_widget',
      node_id: PROMOTED_WIDGET_HOST_NODE_ID,
      widget: 'text',
      value: PROMOTED_WIDGET_NEW_PROMPT,
      promoted: {
        instance_path: [PROMOTED_WIDGET_HOST_NODE_ID],
        value_index: data.promptIndex,
        host_widgets_values: data.hostWidgetValues
      }
    },
    {
      op_id: 'op-2',
      actor: 'agent:test:1',
      base_version: 1,
      stamp: [2, 'agent:test:1'],
      op: 'set_widget',
      node_id: PROMOTED_WIDGET_HOST_NODE_ID,
      widget: 'steps',
      value: PROMOTED_WIDGET_NEW_STEPS,
      promoted: {
        instance_path: [PROMOTED_WIDGET_HOST_NODE_ID],
        value_index: data.stepsIndex,
        host_widgets_values: data.hostWidgetValues
      }
    }
  ]
  const outcomes = applyOps(doc, ops, data.catalog).outcomes
  if (
    outcomes.length !== ops.length ||
    outcomes.some(({ outcome }) => outcome !== 'applied')
  )
    throw new Error('Fixture operations must apply')
  const delta = Y.encodeStateAsUpdate(doc, vectorBefore)
  doc.destroy()

  return { ...data, fullState, delta }
}

export type PromotedWidgetWriteData = ReturnType<
  typeof createPromotedWidgetWriteData
>
