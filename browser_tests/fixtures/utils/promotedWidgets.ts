import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { parsePreviewExposures } from '@/core/schemas/previewExposureSchema'
import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'

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

export async function getPromotedWidgets(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<PromotedWidgetEntry[]> {
  const { widgetSources, previewExposures } = await comfyPage.page.evaluate(
    (id) => {
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
      const serializedNode = node?.serialize()
      return {
        widgetSources,
        previewExposures: serializedNode?.properties?.previewExposures
      }
    },
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

export async function getAllHostPromotedWidgets(
  comfyPage: ComfyPage
): Promise<{ hostNodeId: string; promotedWidgets: PromotedWidgetEntry[] }[]> {
  const hostNodeIds = await comfyPage.page.evaluate(() => {
    const graph = window.app!.canvas.graph!
    return graph._nodes
      .filter(
        (node) =>
          typeof node.isSubgraphNode === 'function' && node.isSubgraphNode()
      )
      .map((node) => String(node.id))
  })

  const entries = await Promise.all(
    hostNodeIds.map(async (hostNodeId) => ({
      hostNodeId,
      promotedWidgets: await getPromotedWidgets(comfyPage, hostNodeId)
    }))
  )

  return entries.sort((a, b) => Number(a.hostNodeId) - Number(b.hostNodeId))
}
