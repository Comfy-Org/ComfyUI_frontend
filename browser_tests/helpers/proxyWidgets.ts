import type { ComfyPage } from '../fixtures/ComfyPage'

export type ProxyWidgetEntry = [string, string]

export function isProxyWidgetEntry(entry: unknown): entry is ProxyWidgetEntry {
  return (
    Array.isArray(entry) &&
    entry.length === 2 &&
    typeof entry[0] === 'string' &&
    typeof entry[1] === 'string'
  )
}

export function normalizeProxyWidgets(value: unknown): ProxyWidgetEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(isProxyWidgetEntry)
}

export async function getProxyWidgets(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<ProxyWidgetEntry[]> {
  const raw = await comfyPage.page.evaluate((id) => {
    const node = window.app!.canvas.graph!.getNodeById(id)
    return node?.properties?.proxyWidgets ?? []
  }, nodeId)

  return normalizeProxyWidgets(raw)
}

export async function getProxyWidgetNames(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<string[]> {
  const proxyWidgets = await getProxyWidgets(comfyPage, nodeId)
  return proxyWidgets.map(([, widgetName]) => widgetName)
}

export async function getNodeWidgetCount(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<number> {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.canvas.graph!.getNodeById(id)
    return node?.widgets?.length ?? 0
  }, nodeId)
}

export async function getNodeWidgetCountByName(
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
