import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export type PromotedWidgetEntry = [string, string]

export interface PromotedWidgetSnapshot {
  proxyWidgets: PromotedWidgetEntry[]
  widgetNames: string[]
}

export function isPromotedWidgetEntry(
  entry: unknown
): entry is PromotedWidgetEntry {
  return (
    Array.isArray(entry) &&
    entry.length === 2 &&
    typeof entry[0] === 'string' &&
    typeof entry[1] === 'string'
  )
}

export function normalizePromotedWidgets(
  value: unknown
): PromotedWidgetEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(isPromotedWidgetEntry)
}

export async function getPromotedWidgets(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<PromotedWidgetEntry[]> {
  const raw = await comfyPage.page.evaluate((id) => {
    const node = window.app!.canvas.graph!.getNodeById(id)
    return node?.properties?.proxyWidgets ?? []
  }, nodeId)

  return normalizePromotedWidgets(raw)
}

export async function getPromotedWidgetSnapshot(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<PromotedWidgetSnapshot> {
  const raw = await comfyPage.page.evaluate((id) => {
    const node = window.app!.canvas.graph!.getNodeById(id)
    return {
      proxyWidgets: node?.properties?.proxyWidgets ?? [],
      widgetNames: (node?.widgets ?? []).map((widget) => widget.name)
    }
  }, nodeId)

  return {
    proxyWidgets: normalizePromotedWidgets(raw.proxyWidgets),
    widgetNames: Array.isArray(raw.widgetNames)
      ? raw.widgetNames.filter(
          (name): name is string => typeof name === 'string'
        )
      : []
  }
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

export function isPseudoPreviewEntry(entry: PromotedWidgetEntry): boolean {
  return entry[1].startsWith('$$')
}

export async function getPseudoPreviewWidgets(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<PromotedWidgetEntry[]> {
  const widgets = await getPromotedWidgets(comfyPage, nodeId)
  return widgets.filter(isPseudoPreviewEntry)
}

export async function getNonPreviewPromotedWidgets(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<PromotedWidgetEntry[]> {
  const widgets = await getPromotedWidgets(comfyPage, nodeId)
  return widgets.filter((entry) => !isPseudoPreviewEntry(entry))
}

export async function getPromotedWidgetCountByName(
  comfyPage: ComfyPage,
  nodeId: string,
  widgetName: string
): Promise<number> {
  return comfyPage.page.evaluate(
    ([id, name]) => {
      const node = window.app!.canvas.graph!.getNodeById(id)
      const widgets = node?.widgets ?? []
      return widgets.filter((widget) => widget.name === name).length
    },
    [nodeId, widgetName] as const
  )
}
