import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
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
  _parents?: SubgraphNode[]
): boolean {
  // For promoted widgets, only rename the external-facing label.
  // Do NOT propagate to interior node widgets/inputs — those are
  // implementation details that should remain unchanged.
  const input = node.inputs?.find((inp) => inp.widget?.name === widget.name)

  widget.label = newLabel || undefined
  if (input) {
    input.label = newLabel || undefined
  }

  node.graph?.trigger('node:slot-label:changed', {
    nodeId: node.id,
    slotType: NodeSlotType.INPUT
  })

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
