import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ISubgraphInput } from '@/lib/litegraph/src/interfaces'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useDialogService } from '@/services/dialogService'

export type WidgetValue = boolean | number | string | object | undefined

export function getWidgetDefaultValue(
  spec: InputSpec | undefined
): WidgetValue {
  if (!spec) return undefined

  if (spec.default !== undefined) return spec.default as WidgetValue

  switch (spec.type) {
    case 'INT':
    case 'FLOAT':
      return 0
    case 'BOOLEAN':
      return false
    case 'STRING':
      return ''
    default:
      if (Array.isArray(spec.options) && spec.options.length > 0) {
        return spec.options[0] as WidgetValue
      }
      return undefined
  }
}

/**
 * Renames a widget and its corresponding input.
 * Handles both regular widgets and promoted widget views in subgraphs.
 *
 * @param widget The widget to rename
 * @param node The node containing the widget
 * @param newLabel The new label for the widget (empty string or undefined to clear)
 * @param parents Optional array of parent SubgraphNodes (for promoted widgets)
 * @returns true if the rename was successful, false otherwise
 */
export function renameWidget(
  widget: IBaseWidget,
  node: LGraphNode,
  newLabel: string,
  parents?: SubgraphNode[]
): boolean {
  if (
    isPromotedWidgetView(widget) &&
    (parents?.length || node.isSubgraphNode())
  ) {
    const sourceWidget = resolvePromotedWidgetSource(node, widget)
    if (!sourceWidget) {
      console.error('Could not resolve source widget for promoted widget')
      return false
    }

    const originalWidget = sourceWidget.widget
    const interiorNode = sourceWidget.node

    originalWidget.label = newLabel || undefined

    const interiorInput = interiorNode.inputs?.find(
      (inp) => inp.widget?.name === originalWidget.name
    )
    if (interiorInput) {
      interiorInput.label = newLabel || undefined
    }
  }

  const input = node.inputs?.find((inp) => inp.widget?.name === widget.name)

  widget.label = newLabel || undefined
  if (input) {
    input.label = newLabel || undefined

    const subgraphSlot = (input as Partial<ISubgraphInput>)._subgraphSlot
    if (subgraphSlot) {
      subgraphSlot.label = newLabel || undefined
    }
  }

  return true
}

export async function promptWidgetLabel(
  widget: IBaseWidget,
  t: (key: string) => string
): Promise<string | null> {
  return useDialogService().prompt({
    title: t('g.rename'),
    message: t('g.enterNewNamePrompt'),
    defaultValue: widget.label,
    placeholder: widget.name
  })
}

export async function promptRenameWidget(
  widget: IBaseWidget,
  node: LGraphNode,
  t: (key: string) => string,
  parents?: SubgraphNode[]
): Promise<string | null> {
  const rawLabel = await promptWidgetLabel(widget, t)
  if (rawLabel === null) return null

  const normalizedLabel = rawLabel.trim()
  if (!normalizedLabel) return null

  if (!renameWidget(widget, node, normalizedLabel, parents)) return null

  widget.callback?.(widget.value)
  useCanvasStore().canvas?.setDirty(true)
  return normalizedLabel
}
