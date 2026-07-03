<script setup lang="ts">
import { isEqual } from 'es-toolkit'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MoreButton from '@/components/button/MoreButton.vue'
import Button from '@/components/ui/button/Button.vue'
import { inputForWidget } from '@/core/graph/subgraph/promotedInputWidget'
import { promoteWidget } from '@/core/graph/subgraph/promotionUtils'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
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

const currentValue = computed(
  () =>
    (widget.widgetId &&
      useWidgetValueStore().getWidget(widget.widgetId)?.value) ??
    widget.value
)

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
      <Button
        variant="textonly"
        size="unset"
        class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-all active:scale-95"
        @click="
          () => {
            handleRename()
            close()
          }
        "
      >
        <i class="icon-[lucide--edit] size-4" />
        <span>{{ t('g.rename') }}</span>
      </Button>

      <Button
        v-if="canShowInput"
        variant="textonly"
        size="unset"
        class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-all active:scale-95"
        @click="
          () => {
            handleShowInput()
            close()
          }
        "
      >
        <i class="icon-[lucide--eye] size-4" />
        <span>{{ t('rightSidePanel.showInput') }}</span>
      </Button>

      <Button
        variant="textonly"
        size="unset"
        class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-all active:scale-95"
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
      </Button>

      <Button
        v-if="hasDefault"
        variant="textonly"
        size="unset"
        class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-all active:scale-95"
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
      </Button>
    </template>
  </MoreButton>
</template>
