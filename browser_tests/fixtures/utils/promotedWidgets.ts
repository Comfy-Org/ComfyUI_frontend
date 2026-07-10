import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'

import { parsePreviewExposures } from '@/core/schemas/previewExposureSchema'
import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export type PromotedWidgetEntry = [string, string]

interface ResolvedWidgetSource {
  sourceNodeId: string
  sourceWidgetName: string
}

function widgetSourceToEntry(
  source: ResolvedWidgetSource
): PromotedWidgetEntry {
  return [source.sourceNodeId, source.sourceWidgetName]
}

function previewExposureToEntry(
  exposure: PreviewExposure
): PromotedWidgetEntry {
  return [exposure.sourceNodeId, exposure.sourcePreviewName]
}

function isNodeProperty(value: unknown): value is NodeProperty {
  if (value === null || value === undefined) return false
  const t = typeof value
  return t === 'string' || t === 'number' || t === 'boolean' || t === 'object'
}

/**
 * Reads the promoted widgets of a subgraph host node from the live graph.
 *
 * Promoted widgets are now store-backed: a host input is promoted iff it
 * carries a `widgetId`, and its interior source identity is resolved on demand
 * by walking the subgraph input link (mirroring `resolveSubgraphInputTarget`).
 * This intentionally avoids the removed `widget.sourceNodeId`/`sourceWidgetName`
 * denormalization, so the helper reflects the real projection rather than a
 * deleted widget-object contract.
 */
export async function getPromotedWidgets(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<PromotedWidgetEntry[]> {
  const localNodeId = toNodeId(nodeId)
  const { widgetSources, previewExposures } = await comfyPage.page.evaluate(
    (id) => {
      const node = window.app!.canvas.graph!.getNodeById(id)
      const previewExposures = node?.serialize()?.properties?.previewExposures
      if (!node?.isSubgraphNode?.())
        return { widgetSources: [], previewExposures }

      const { subgraph } = node
      const resolveSource = (
        inputName: string
      ): ResolvedWidgetSource | undefined => {
        const inputSlot = subgraph.inputNode.slots.find(
          (slot) => slot.name === inputName
        )
        if (!inputSlot) return undefined
        for (const linkId of inputSlot.linkIds) {
          const link = subgraph.getLink(linkId)
          if (!link) continue
          const { inputNode } = link.resolve(subgraph)
          if (!inputNode || !Array.isArray(inputNode.inputs)) continue
          const targetInput = inputNode.inputs.find(
            (entry) => entry.link === linkId
          )
          if (!targetInput) continue
          if (inputNode.isSubgraphNode?.()) {
            return {
              sourceNodeId: String(inputNode.id),
              sourceWidgetName: targetInput.name
            }
          }
          const widget = inputNode.getWidgetFromSlot(targetInput)
          if (!widget) continue
          return {
            sourceNodeId: String(inputNode.id),
            sourceWidgetName: widget.name
          }
        }
        return undefined
      }

      const widgetSources = (node.inputs ?? []).flatMap((input) => {
        if (!input.widgetId) return []
        const source = resolveSource(input.name)
        return source ? [source] : []
      })
      return { widgetSources, previewExposures }
    },
    localNodeId
  )

  const exposures = isNodeProperty(previewExposures)
    ? parsePreviewExposures(previewExposures)
    : []
  return [
    ...widgetSources.map(widgetSourceToEntry),
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
