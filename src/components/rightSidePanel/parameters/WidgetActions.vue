<script setup lang="ts">
import { isEqual } from 'es-toolkit'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MoreButton from '@/components/button/MoreButton.vue'
import { menuButtonClass } from '@/components/ui/menu/menuStyles'
import { inputForWidget } from '@/core/graph/subgraph/promotedInputWidget'
import { promoteWidget } from '@/core/graph/subgraph/promotionUtils'
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
</script>

<template>
  <MoreButton
    is-vertical
    data-testid="widget-actions-menu-button"
    class="bg-transparent text-muted-foreground transition-all hover:bg-secondary-background-hover hover:text-base-foreground active:scale-95"
  >
    <template #default="{ close }">
      <button
        type="button"
        :class="menuButtonClass"
        @click="
          () => {
            handleRename()
            close()
          }
        "
      >
        <i class="icon-[lucide--edit] size-4" />
        <span>{{ t('g.rename') }}</span>
      </button>

      <button
        v-if="canShowInput"
        type="button"
        :class="menuButtonClass"
        @click="
          () => {
            handleShowInput()
            close()
          }
        "
      >
        <i class="icon-[lucide--eye] size-4" />
        <span>{{ t('rightSidePanel.showInput') }}</span>
      </button>

      <button
        type="button"
        :class="menuButtonClass"
        @click="
          () => {
            handleToggleFavorite()
            close()
          }
        "
      >
        <template v-if="isFavorited">
          <i class="icon-[lucide--star] size-4" />
          <span>{{ t('rightSidePanel.removeFavorite') }}</span>
        </template>
        <template v-else>
          <i class="icon-[lucide--star] size-4" />
          <span>{{ t('rightSidePanel.addFavorite') }}</span>
        </template>
      </button>

      <button
        v-if="hasDefault"
        type="button"
        :class="menuButtonClass"
        :disabled="isCurrentValueDefault"
        @click="
          () => {
            handleResetToDefault()
            close()
          }
        "
      >
        <i class="icon-[lucide--rotate-ccw] size-4" />
        <span>{{ t('rightSidePanel.resetToDefault') }}</span>
      </button>
    </template>
  </MoreButton>
</template>
