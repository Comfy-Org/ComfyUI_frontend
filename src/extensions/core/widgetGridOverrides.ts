import { t } from '@/i18n'
import type { IContextMenuValue } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { app } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'

const PROPERTY_KEY = 'gridOverrides'
const DEFAULT_PROMPT_VALUE = '200px'

type GridOverrides = Record<string, string>

function readOverrides(node: LGraphNode): GridOverrides {
  const raw = node.properties?.[PROPERTY_KEY]
  if (!raw || typeof raw !== 'object') return {}
  return { ...(raw as GridOverrides) }
}

function writeOverrides(node: LGraphNode, next: GridOverrides): void {
  node.properties ??= {}
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
  const input = window.prompt(t('widgetGridOverrides.prompt'), current)
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
    : `${widgetName}  →  ${t('widgetGridOverrides.auto')}`

  return {
    content: label,
    has_submenu: true,
    callback: () => {
      promptForRowSize(current ?? DEFAULT_PROMPT_VALUE, (value) =>
        setOverride(node, widgetName, value)
      )
    },
    submenu: {
      options: [
        {
          content: t('widgetGridOverrides.setSize'),
          callback: () => {
            promptForRowSize(current ?? DEFAULT_PROMPT_VALUE, (value) =>
              setOverride(node, widgetName, value)
            )
          }
        },
        {
          content: t('widgetGridOverrides.clearOverride'),
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
        content: t('widgetGridOverrides.clearAll'),
        callback: () => writeOverrides(node, {})
      })
    }

    return [
      null,
      {
        content: t('widgetGridOverrides.menuLabel'),
        has_submenu: true,
        callback: () => {},
        submenu: {
          options: widgetItems
        }
      }
    ]
  }
})
