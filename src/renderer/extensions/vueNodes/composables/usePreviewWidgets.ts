import type { TooltipOptions } from 'primevue'
import { computed } from 'vue'
import type { Component } from 'vue'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ProcessedWidget } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { isWidgetVisible } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
  shouldExpand
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useWidgetStore } from '@/stores/widgetStore'
import type { WidgetValue } from '@/types/simplifiedWidget'

const EMPTY_TOOLTIP: TooltipOptions = {}
const noop = () => {}

/**
 * Builds render-ready widgets for a static node preview straight from its
 * schema, without registering anything in the widget stores. Previews have no
 * live graph, so nothing here needs (or should touch) store-backed state.
 */
export function usePreviewWidgets(
  nodeDefGetter: () => ComfyNodeDefV2,
  widgetValuesGetter: () => Record<string, string> | undefined
) {
  const widgetStore = useWidgetStore()
  const settingStore = useSettingStore()
  const showAdvanced = computed(() =>
    Boolean(settingStore.get('Comfy.Node.AlwaysShowAdvancedWidgets'))
  )

  const processedWidgets = computed<ProcessedWidget[]>(() => {
    const nodeDef = nodeDefGetter()
    const widgetValues = widgetValuesGetter()
    return Object.entries(nodeDef.inputs || {})
      .filter(([, input]) => widgetStore.inputIsWidget(input))
      .map(([name, input]): ProcessedWidget => {
        const comboValues =
          input.type === 'COMBO' && Array.isArray(input.options)
            ? input.options
            : undefined
        const leadValue = widgetValues?.[name]
        const value = (leadValue ??
          (input.default !== undefined
            ? input.default
            : (comboValues?.[0] ?? ''))) as WidgetValue
        const options = {
          hidden: input.hidden,
          advanced: input.advanced,
          values:
            leadValue && comboValues
              ? [
                  leadValue,
                  ...comboValues.filter((option) => option !== leadValue)
                ]
              : comboValues
        } satisfies IWidgetOptions
        const type = input.widgetType || input.type
        const vueComponent: Component = getComponent(type) ?? WidgetLegacy
        return {
          advanced: Boolean(input.advanced),
          handleContextMenu: noop,
          hasLayoutSize: false,
          hasError: false,
          hidden: Boolean(input.hidden),
          name,
          renderKey: `preview:${nodeDef.name}:${name}`,
          simplified: { name, type, value, options, spec: input },
          tooltipConfig: EMPTY_TOOLTIP,
          type,
          updateHandler: noop,
          value,
          visible: isWidgetVisible(options, showAdvanced.value),
          vueComponent,
          slotMetadata: undefined
        }
      })
  })

  const gridTemplateRows = computed(() =>
    processedWidgets.value
      .filter((widget) => widget.visible)
      .map((widget) => (shouldExpand(widget.type) ? 'auto' : 'min-content'))
      .join(' ')
  )

  return { processedWidgets, gridTemplateRows }
}
