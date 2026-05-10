import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export type PromotedWidgetEntry = [string, string]

function isPromotedWidgetEntry(entry: unknown): entry is PromotedWidgetEntry {
  return (
    Array.isArray(entry) &&
    entry.length === 2 &&
    typeof entry[0] === 'string' &&
    typeof entry[1] === 'string'
  )
}

function normalizePromotedWidgets(value: unknown): PromotedWidgetEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(isPromotedWidgetEntry)
}

export async function getPromotedWidgets(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<PromotedWidgetEntry[]> {
  const raw = await comfyPage.page.evaluate((id) => {
    const node = window.app!.canvas.graph!.getNodeById(id)
    const widgets = node?.widgets ?? []

    // Read the live promoted widget views from the host node instead of the
    // serialized proxyWidgets snapshot, which can lag behind the current graph
    // state during promotion and cleanup flows.
    const widgetEntries = widgets.flatMap((widget) => {
      if (
        widget &&
        typeof widget === 'object' &&
        'sourceNodeId' in widget &&
        typeof widget.sourceNodeId === 'string' &&
        'sourceWidgetName' in widget &&
        typeof widget.sourceWidgetName === 'string'
      ) {
        return [[widget.sourceNodeId, widget.sourceWidgetName]]
      }
      return []
    })

    const serialized = window.app!.graph!.serialize()
    const serializedNode = serialized.nodes.find(
      (candidate) => String(candidate.id) === String(id)
    )
    const previewExposures = serializedNode?.properties?.previewExposures
    const previewEntries = Array.isArray(previewExposures)
      ? previewExposures.flatMap((exposure) => {
          if (
            typeof exposure === 'object' &&
            exposure !== null &&
            'sourceNodeId' in exposure &&
            typeof exposure.sourceNodeId === 'string' &&
            'sourcePreviewName' in exposure &&
            typeof exposure.sourcePreviewName === 'string'
          ) {
            return [[exposure.sourceNodeId, exposure.sourcePreviewName]]
          }
          return []
        })
      : []

    return [...widgetEntries, ...previewEntries]
  }, nodeId)

  return normalizePromotedWidgets(raw)
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
