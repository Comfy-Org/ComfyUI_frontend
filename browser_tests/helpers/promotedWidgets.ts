import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

type PromotedWidgetEntry = [string, string]

export interface PromotedWidgetSnapshot {
  proxyWidgets: PromotedWidgetEntry[]
  widgetNames: string[]
}

export function getPiniaStoreInBrowser(storeName: string) {
  type StoreRecord = Record<string, (...args: unknown[]) => unknown>
  const el = document.getElementById('vue-app') as HTMLElement & {
    __vue_app__?: {
      config: {
        globalProperties: { $pinia?: { _s: Map<string, StoreRecord> } }
      }
    }
  }
  const store =
    el.__vue_app__?.config?.globalProperties?.$pinia?._s.get(storeName)
  if (!store) throw new Error(`Pinia store "${storeName}" not found`)
  return store
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
    return widgets.flatMap((widget) => {
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
  return comfyPage.page.evaluate(
    ([id, name]) => {
      const node = window.app!.canvas.graph!.getNodeById(id)
      const widgets = node?.widgets ?? []
      return widgets.filter((widget) => widget.name === name).length
    },
    [nodeId, widgetName] as const
  )
}
