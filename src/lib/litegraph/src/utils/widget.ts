import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'

/**
 * The step value for numeric widgets.
 * Use {@link IWidgetOptions.step2} if available, otherwise fallback to
 * {@link IWidgetOptions.step} which is scaled up by 10x in the legacy frontend logic.
 */
export function getWidgetStep(options: IWidgetOptions<unknown>): number {
  return options.step2 || (options.step || 10) * 0.1
}
