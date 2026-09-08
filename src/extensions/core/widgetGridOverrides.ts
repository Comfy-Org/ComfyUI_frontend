import PromptDialogContent from '@/components/dialog/content/PromptDialogContent.vue'
import { t } from '@/i18n'
import type { IContextMenuValue } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { app } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'
import { useDialogStore } from '@/stores/dialogStore'
import {
  clearAllGridOverrides,
  clearGridOverride,
  readGridOverrides,
  setGridOverride
} from '@/utils/widgetGridOverrides'

const DEFAULT_SIZE = '200px'

function applyOverride(
  node: LGraphNode,
  widgetName: string,
  value: string
): void {
  setGridOverride(node, widgetName, value)
  app.canvas?.setDirty(true, true)
}

function removeOverride(node: LGraphNode, widgetName: string): void {
  clearGridOverride(node, widgetName)
  app.canvas?.setDirty(true, true)
}

function removeAllOverrides(node: LGraphNode): void {
  clearAllGridOverrides(node)
  app.canvas?.setDirty(true, true)
}

function openSizeDialog(
  currentValue: string | undefined,
  onSubmit: (value: string) => void
): void {
  useDialogStore().showDialog({
    key: 'widget-grid-size',
    title: t('widgetGridOverrides.sizeLabel'),
    component: PromptDialogContent,
    props: {
      message: t('widgetGridOverrides.prompt'),
      defaultValue: currentValue ?? DEFAULT_SIZE,
      placeholder: '200px',
      onConfirm: (value: string) => {
        const trimmed = value.trim()
        if (trimmed.length > 0) onSubmit(trimmed)
      }
    },
    dialogComponentProps: {
      modal: true,
      closable: true,
      dismissableMask: true
    }
  })
}

function buildWidgetMenuItem(
  node: LGraphNode,
  widgetName: string
): IContextMenuValue {
  const current = readGridOverrides(node)?.[widgetName]
  const label = current
    ? `${widgetName}  →  ${current}`
    : `${widgetName}  →  ${t('widgetGridOverrides.auto')}`

  const openSetSize = () => {
    openSizeDialog(current, (value) => applyOverride(node, widgetName, value))
  }

  return {
    content: label,
    has_submenu: true,
    callback: openSetSize,
    submenu: {
      options: [
        {
          content: t('widgetGridOverrides.setSize'),
          callback: openSetSize
        },
        {
          content: t('widgetGridOverrides.clearOverride'),
          disabled: !current,
          callback: () => removeOverride(node, widgetName)
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

    const widgetItems: (IContextMenuValue | null)[] = widgets.map((widget) =>
      buildWidgetMenuItem(node, widget.name)
    )

    if (readGridOverrides(node)) {
      widgetItems.push(null, {
        content: t('widgetGridOverrides.clearAll'),
        callback: () => removeAllOverrides(node)
      })
    }

    return [
      null,
      {
        content: t('widgetGridOverrides.menuLabel'),
        has_submenu: true,
        callback: () => {},
        submenu: { options: widgetItems }
      }
    ]
  }
})
