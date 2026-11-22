import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useSettingStore } from '@/platform/settings/settingStore'
import {
  deriveWidgetVisibility,
  isWidgetVisibleOnSurface
} from '@/types/widgetVisibility'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

export type NodeWidgetsList = Array<{ node: LGraphNode; widget: IBaseWidget }>
export type NodeWidgetsListList = Array<{
  node: LGraphNode
  widgets: NodeWidgetsList
}>

export function computedSectionDataList(nodes: MaybeRefOrGetter<LGraphNode[]>) {
  const settingStore = useSettingStore()

  const includesAdvanced = computed(() =>
    settingStore.get('Comfy.Node.AlwaysShowAdvancedWidgets')
  )

  const widgetsSectionDataList = computed((): NodeWidgetsListList => {
    return toValue(nodes).map((node) => {
      const { widgets = [] } = node
      const shownWidgets = widgets
        .filter((w) =>
          isWidgetVisibleOnSurface(
            w.visibility ?? deriveWidgetVisibility(w),
            'panel',
            { showAdvanced: includesAdvanced.value }
          )
        )
        .map((widget) => ({ node, widget }))
      return { widgets: shownWidgets, node }
    })
  })

  return {
    widgetsSectionDataList,
    includesAdvanced
  }
}
