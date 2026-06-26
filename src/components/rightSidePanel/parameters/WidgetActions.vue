<script setup lang="ts">
import { isEqual } from 'es-toolkit'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MoreButton from '@/components/button/MoreButton.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import { widgetPromotedSource } from '@/core/graph/subgraph/promotedInputWidget'
import {
  demotePromotedInput,
  demoteWidget,
  isLinkedPromotion,
  promoteWidget
} from '@/core/graph/subgraph/promotionUtils'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'
import { getWidgetDefaultValue, promptWidgetLabel } from '@/utils/widgetUtil'
import type { WidgetValue } from '@/utils/widgetUtil'

const {
  widget,
  node,
  parents = [],
  isShownOnParents = false
} = defineProps<{
  widget: IBaseWidget
  node: LGraphNode
  parents?: SubgraphNode[]
  isShownOnParents?: boolean
}>()

const emit = defineEmits<{
  resetToDefault: [value: WidgetValue]
}>()

const label = defineModel<string>('label', { required: true })

const canvasStore = useCanvasStore()
const favoritedWidgetsStore = useFavoritedWidgetsStore()
const nodeDefStore = useNodeDefStore()
const { t } = useI18n()

const hasParents = computed(() => parents?.length > 0)
const isLinked = computed(() => {
  if (!node.isSubgraphNode()) return false
  const source = widgetPromotedSource(node, widget)
  if (!source) return false
  return isLinkedPromotion(node, source.nodeId, source.widgetName)
})
const canToggleVisibility = computed(() => hasParents.value && !isLinked.value)
const favoriteNode = computed(() =>
  isShownOnParents && hasParents.value ? parents[0] : node
)
const isFavorited = computed(() =>
  favoritedWidgetsStore.isFavorited(favoriteNode.value, widget.name)
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

function handleHideInput() {
  if (!parents?.length) return

  const source = widgetPromotedSource(node, widget)
  if (source) {
    for (const parent of parents) {
      const sourceNodeId =
        String(node.id) === String(parent.id) ? source.nodeId : String(node.id)
      demotePromotedInput(parent, {
        sourceNodeId,
        sourceWidgetName: source.widgetName
      })
    }
    canvasStore.canvas?.setDirty(true, true)
  } else {
    demoteWidget(node, widget, parents)
  }
}

function handleShowInput() {
  if (!parents?.length) return
  promoteWidget(node, widget, parents)
}

function handleToggleFavorite() {
  favoritedWidgetsStore.toggleFavorite(favoriteNode.value, widget.name)
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
    <DropdownMenuItem @select="handleRename">
      <template #icon><i class="icon-[lucide--edit]" /></template>
      {{ t('g.rename') }}
    </DropdownMenuItem>

    <DropdownMenuItem
      v-if="canToggleVisibility"
      @select="isShownOnParents ? handleHideInput() : handleShowInput()"
    >
      <template #icon>
        <i
          :class="
            isShownOnParents ? 'icon-[lucide--eye-off]' : 'icon-[lucide--eye]'
          "
        />
      </template>
      {{
        isShownOnParents
          ? t('rightSidePanel.hideInput')
          : t('rightSidePanel.showInput')
      }}
    </DropdownMenuItem>

    <DropdownMenuItem @select="handleToggleFavorite">
      <template #icon><i class="icon-[lucide--star]" /></template>
      {{
        isFavorited
          ? t('rightSidePanel.removeFavorite')
          : t('rightSidePanel.addFavorite')
      }}
    </DropdownMenuItem>

    <DropdownMenuItem
      v-if="hasDefault"
      :disabled="isCurrentValueDefault"
      @select="handleResetToDefault"
    >
      <template #icon><i class="icon-[lucide--rotate-ccw]" /></template>
      {{ t('rightSidePanel.resetToDefault') }}
    </DropdownMenuItem>
  </MoreButton>
</template>
