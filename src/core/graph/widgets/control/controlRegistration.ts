import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

/**
 * Registers the control component for a target widget from its transient
 * `controlConfig`. Idempotent and safe to call before or after the widget is
 * bound to a node, so control registration follows the same deferral as value
 * registration.
 */
export function registerWidgetControlFromConfig(widget: IBaseWidget): void {
  const config = widget.controlConfig
  if (!config) return
  const targetId = widget.widgetId
  if (!targetId) return

  useWidgetValueStore().registerWidgetControl(targetId, {
    mode: config.mode,
    filter: config.hasFilter ? '' : undefined
  })
}
