import type { IContextMenuValue } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { app } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'

const PROPERTY_KEY = 'gridOverrides'
const PROMPT_LABEL =
  'Grid row size (e.g. 200px, minmax(150px, 300px), 1fr, auto)'

type GridOverrides = Record<string, string>

function readOverrides(node: LGraphNode): GridOverrides {
  const raw = node.properties?.[PROPERTY_KEY]
  if (!raw || typeof raw !== 'object') return {}
  return { ...(raw as GridOverrides) }
}

function writeOverrides(node: LGraphNode, next: GridOverrides): void {
  if (Object.keys(next).length === 0) {
    delete node.properties[PROPERTY_KEY]
  } else {
    node.properties[PROPERTY_KEY] = next
  }
  refreshVueNode(String(node.id))
  app.canvas?.setDirty(true, true)
}

function refreshVueNode(nodeId: string): void {
  const manager = useVueNodeLifecycle().nodeManager.value
  manager?.refreshNode(nodeId)
}

function promptForRowSize(
  current: string,
  onSubmit: (value: string) => void
): void {
  const input = window.prompt(PROMPT_LABEL, current)
  if (input == null) return
  const trimmed = input.trim()
  if (trimmed.length === 0) return
  onSubmit(trimmed)
}

function setOverride(
  node: LGraphNode,
  widgetName: string,
  value: string
): void {
  const next = readOverrides(node)
  next[widgetName] = value
  writeOverrides(node, next)
}

function clearOverride(node: LGraphNode, widgetName: string): void {
  const next = readOverrides(node)
  delete next[widgetName]
  writeOverrides(node, next)
}

function buildWidgetMenuItem(
  node: LGraphNode,
  widgetName: string
): IContextMenuValue {
  const overrides = readOverrides(node)
  const current = overrides[widgetName]
  const label = current
    ? `${widgetName}  →  ${current}`
    : `${widgetName}  →  (auto)`

  return {
    content: label,
    has_submenu: true,
    callback: () => {
      promptForRowSize(current ?? '200px', (value) =>
        setOverride(node, widgetName, value)
      )
    },
    submenu: {
      options: [
        {
          content: 'Set size…',
          callback: () => {
            promptForRowSize(current ?? '200px', (value) =>
              setOverride(node, widgetName, value)
            )
          }
        },
        {
          content: 'Clear override',
          disabled: !current,
          callback: () => clearOverride(node, widgetName)
        }
      ]
    }
  }
}

useExtensionService().registerExtension({
  name: 'Comfy.WidgetGridOverrides',
  getNodeMenuItems(node: LGraphNode): (IContextMenuValue | null)[] {
    const widgets = node.widgets ?? []
    if (widgets.length === 0) return []

    const overrides = readOverrides(node)
    const hasAny = Object.keys(overrides).length > 0

    const widgetItems: (IContextMenuValue | null)[] = widgets.map((widget) =>
      buildWidgetMenuItem(node, widget.name)
    )

    if (hasAny) {
      widgetItems.push(null, {
        content: 'Clear all overrides',
        callback: () => writeOverrides(node, {})
      })
    }

    return [
      null,
      {
        content: 'Widget Grid Sizes',
        has_submenu: true,
        callback: () => {},
        submenu: {
          options: widgetItems
        }
      }
    ]
  }
})
