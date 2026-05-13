import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { parsePreviewExposures } from '@/core/schemas/previewExposureSchema';
import type { PreviewExposure } from '@/core/schemas/previewExposureSchema';

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export type PromotedWidgetEntry = [string, string]

function widgetSourceToEntry(
  source: PromotedWidgetSource
): PromotedWidgetEntry {
  return [source.sourceNodeId, source.sourceWidgetName]
}

function previewExposureToEntry(
  exposure: PreviewExposure
): PromotedWidgetEntry {
  return [exposure.sourceNodeId, exposure.sourcePreviewName]
}

export function isPromotedWidgetSource(
  value: unknown
): value is PromotedWidgetSource {
  return (
    !!value &&
    typeof value === 'object' &&
    'sourceNodeId' in value &&
    'sourceWidgetName' in value &&
    typeof value.sourceNodeId === 'string' &&
    typeof value.sourceWidgetName === 'string'
  )
}

export function isNodeProperty(value: unknown): value is NodeProperty {
  if (value === null || value === undefined) return false
  const t = typeof value
  return t === 'string' || t === 'number' || t === 'boolean' || t === 'object'
}

interface RawHostSnapshot {
  widgetSources: unknown[]
  previewExposures: unknown
}

async function readRawHostSnapshot(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<RawHostSnapshot> {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.canvas.graph!.getNodeById(id)
    const widgetSources = (node?.widgets ?? []).flatMap((widget) => {
      if (!('sourceNodeId' in widget) || !('sourceWidgetName' in widget))
        return []
      return [
        {
          sourceNodeId: widget.sourceNodeId,
          sourceWidgetName: widget.sourceWidgetName
        }
      ]
    })
    const serialized = window.app!.graph!.serialize()
    const serializedNode = serialized.nodes.find(
      (candidate) => String(candidate.id) === String(id)
    )
    return {
      widgetSources,
      previewExposures: serializedNode?.properties?.previewExposures
    }
  }, nodeId)
}

export async function getPromotedWidgets(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<PromotedWidgetEntry[]> {
  // Read live promoted widget views from the host node and merge with the
  // serialized previewExposures snapshot, since each represents a different
  // category of promoted slot. Validation/typing is done outside page.evaluate
  // using canonical guards/schemas from src/.
  const { widgetSources, previewExposures } = await readRawHostSnapshot(
    comfyPage,
    nodeId
  )

  const exposures = isNodeProperty(previewExposures)
    ? parsePreviewExposures(previewExposures)
    : []
  return [
    ...widgetSources.filter(isPromotedWidgetSource).map(widgetSourceToEntry),
    ...exposures.map(previewExposureToEntry)
  ]
}

export async function getPromotedWidgetNames(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<string[]> {
  const promotedWidgets = await getPromotedWidgets(comfyPage, nodeId)
  return promotedWidgets.map(([, widgetName]) => widgetName)
}

export async function getPromotedWidgetCount(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<number> {
  const promotedWidgets = await getPromotedWidgets(comfyPage, nodeId)
  return promotedWidgets.length
}

function isPseudoPreviewEntry(entry: PromotedWidgetEntry): boolean {
  return entry[1].startsWith('$$')
}

export async function getPseudoPreviewWidgets(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<PromotedWidgetEntry[]> {
  const widgets = await getPromotedWidgets(comfyPage, nodeId)
  return widgets.filter(isPseudoPreviewEntry)
}

export async function getPromotedWidgetCountByName(
  comfyPage: ComfyPage,
  nodeId: string,
  widgetName: string
): Promise<number> {
  const promotedWidgets = await getPromotedWidgets(comfyPage, nodeId)
  return promotedWidgets.filter(([, name]) => name === widgetName).length
}
