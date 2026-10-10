<script setup lang="ts">
import { isEqual } from 'es-toolkit'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import {
  inputForWidget,
  resolveImmediatePromotedWidgetSource
} from '@/core/graph/subgraph/promotedInputWidget'
import {
  demoteWidget,
  promoteWidget
} from '@/core/graph/subgraph/promotionUtils'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useTelemetry } from '@/platform/telemetry'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'
import { getWidgetDefaultValue, promptWidgetLabel } from '@/utils/widgetUtil'
import type { WidgetValue } from '@/utils/widgetUtil'

const { widget, node, host } = defineProps<{
  widget: IBaseWidget
  node: LGraphNode
  host?: SubgraphNode
}>()

const emit = defineEmits<{
  resetToDefault: [value: WidgetValue]
}>()

const label = defineModel<string>('label', { required: true })

const favoritedWidgetsStore = useFavoritedWidgetsStore()
const nodeDefStore = useNodeDefStore()
const { t } = useI18n()

const isLinked = computed(() => {
  if (!node.isSubgraphNode()) return false
  return inputForWidget(node, widget)?.widgetId != null
})
const canShowInput = computed(() => host != null && !isLinked.value)
const canHideInput = computed(() => host != null && isLinked.value)
const isFavorited = computed(() =>
  favoritedWidgetsStore.isFavorited(node, widget.name)
)

const inputSpec = computed(() =>
  nodeDefStore.getInputSpecForWidget(node, widget.name)
)

const defaultValue = computed(() => getWidgetDefaultValue(inputSpec.value))

const hasDefault = computed(() => defaultValue.value !== undefined)

const currentValue = computed(() => {
  if (!widget.widgetId) return widget.value
  const state = useWidgetValueStore().getWidget(widget.widgetId)
  return state ? state.value : widget.value
})

const isCurrentValueDefault = computed(() => {
  if (!hasDefault.value) return true
  return isEqual(currentValue.value, defaultValue.value)
})

async function handleRename() {
  const newLabel = await promptWidgetLabel(widget, t)
  if (newLabel !== null) label.value = newLabel
}

function handleShowInput() {
  if (!host) return
  promoteWidget(node, widget, [host])
}

function handleHideInput() {
  if (!host) return
  const source = resolveImmediatePromotedWidgetSource(node, widget)
  if (!source) return
  demoteWidget(source.sourceNode, source.sourceWidget, [host])
}

function handleToggleFavorite() {
  useTelemetry()?.trackWidgetFavoriteToggled({
    node_type: node.type,
    widget_name: widget.name,
    widget_type: widget.type,
    is_favorited: !isFavorited.value,
    source: 'right_side_panel'
  })
  favoritedWidgetsStore.toggleFavorite(node, widget.name)
}

function handleResetToDefault() {
  if (!hasDefault.value) return
  emit('resetToDefault', defaultValue.value)
}

const menuItems = computed<MenuItem[]>(() => [
  {
    label: () => t('g.rename'),
    icon: 'icon-[lucide--edit]',
    command: handleRename
  },
  {
    label: () => t('rightSidePanel.showInput'),
    icon: 'icon-[lucide--eye]',
    visible: () => canShowInput.value,
    command: handleShowInput
  },
  {
    label: () =>
      t(
        isFavorited.value
          ? 'rightSidePanel.removeFavorite'
          : 'rightSidePanel.addFavorite'
      ),
    icon: 'icon-[lucide--star]',
    command: handleToggleFavorite
  },
  {
    label: () => t('rightSidePanel.resetToDefault'),
    icon: 'icon-[lucide--rotate-ccw]',
    visible: () => hasDefault.value,
    disabled: () => isCurrentValueDefault.value,
    command: handleResetToDefault
  }
])
</script>

<template>
  <Button
    v-if="canHideInput"
    size="icon"
    variant="muted-textonly"
    data-testid="widget-actions-hide-input-button"
    icon="icon-[lucide--eye-off]"
    :aria-label="t('rightSidePanel.hideInput')"
    @click="handleHideInput"
  />
  <Menu :items="menuItems" align="end">
    <template #trigger>
      <Button
        size="icon"
        variant="muted-textonly"
        data-testid="widget-actions-menu-button"
        icon="icon-[lucide--more-vertical]"
        :aria-label="t('g.more')"
      />
    </template>
  </Menu>
</template>
