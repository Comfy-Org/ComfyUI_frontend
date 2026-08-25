import { promotedInputSource } from '@/core/graph/subgraph/promotedInputWidget'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'

import { isValueControlWidget, nextValueForLinkedTarget } from './valueControl'

/**
 * A promoted subgraph host widget whose interior source widget is driven by a
 * `control_after_generate` widget. The host owns the value (store-backed), while
 * the interior linked widgets supply the control mode and filter (ADR 0009).
 */
interface PromotedControlTarget {
  hostWidget: IBaseWidget
  linkedWidgets: IBaseWidget[]
}

function collectPromotedControlTargets(
  node: LGraphNode
): PromotedControlTarget[] {
  if (!node.isSubgraphNode()) return []

  const targets: PromotedControlTarget[] = []
  for (const [index, input] of node.inputs.entries()) {
    // Promoted inputs are store-backed and addressed by widgetId.
    if (!input.widgetId) continue

    // An incoming link means the value is fed externally (or by an outer
    // subgraph boundary in the nested case), so the host store is not the
    // authoritative source and control must not run here.
    if (node.isInputConnected(index)) continue

    const source = promotedInputSource(node, input)
    if (!source) continue

    const resolution = resolveConcretePromotedWidget(
      node,
      source.nodeId,
      source.widgetName
    )
    if (resolution.status !== 'resolved') continue

    const { linkedWidgets } = resolution.resolved.widget
    if (!linkedWidgets?.some(isValueControlWidget)) continue

    const hostWidget = node.getWidgetFromSlot(input)
    if (!hostWidget) continue

    targets.push({ hostWidget, linkedWidgets })
  }
  return targets
}

function applyTarget(
  target: PromotedControlTarget,
  nodeId: unknown,
  isPartialExecution: boolean | undefined
): void {
  const next = nextValueForLinkedTarget({
    target: target.hostWidget,
    linkedWidgets: target.linkedWidgets,
    nodeId,
    isPartialExecution
  })
  if (next === undefined) return

  target.hostWidget.value = next
  target.hostWidget.callback?.(next)
}

function controlValueRunBefore(): boolean {
  return useSettingStore().get('Comfy.WidgetControlMode') === 'before'
}

/**
 * Host widgets that have run control at least once, so `before` mode can skip
 * the first execution (mirroring the interior control widget's HAS_EXECUTED).
 *
 * Keyed by the widget instance so entries are released when the graph is
 * cleared and its widgets are recreated, avoiding stale state across reloads.
 */
const executedWidgets = new WeakSet<IBaseWidget>()

/**
 * Applies `control_after_generate` to a subgraph host node's promoted widgets.
 *
 * The interior control widget short-circuits for promoted inputs because the
 * interior widget is link-fed by the subgraph boundary, so its value is dead.
 * The authoritative value lives on the host node (store-backed), and this
 * applies the next controlled value there.
 */
export function applyPromotedWidgetControl(
  node: LGraphNode,
  phase: 'beforeQueued' | 'afterQueued',
  { isPartialExecution }: { isPartialExecution?: boolean } = {}
): void {
  const runBefore = controlValueRunBefore()
  if (phase === 'beforeQueued' && !runBefore) return
  if (phase === 'afterQueued' && runBefore) return

  for (const target of collectPromotedControlTargets(node)) {
    if (phase === 'afterQueued') {
      applyTarget(target, node.id, isPartialExecution)
      continue
    }

    if (executedWidgets.has(target.hostWidget)) {
      applyTarget(target, node.id, isPartialExecution)
    }
    executedWidgets.add(target.hostWidget)
  }
}
