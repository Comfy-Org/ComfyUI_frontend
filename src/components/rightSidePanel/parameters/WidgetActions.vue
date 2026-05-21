<script setup lang="ts">
import { isEqual } from 'es-toolkit'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MoreButton from '@/components/button/MoreButton.vue'
import Button from '@/components/ui/button/Button.vue'
import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import {
  demoteWidget,
  isLinkedPromotion,
  promoteWidget
} from '@/core/graph/subgraph/promotionUtils'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { usePromotionStore } from '@/stores/promotionStore'
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
const promotionStore = usePromotionStore()
const { t } = useI18n()

const hasParents = computed(() => parents?.length > 0)
const isLinked = computed(() => {
  if (!node.isSubgraphNode() || !isPromotedWidgetView(widget)) return false
  return isLinkedPromotion(node, widget.sourceNodeId, widget.sourceWidgetName)
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

const isCurrentValueDefault = computed(() => {
  if (!hasDefault.value) return true
  return isEqual(widget.value, defaultValue.value)
})

async function handleRename() {
  const newLabel = await promptWidgetLabel(widget, t)
  if (newLabel !== null) label.value = newLabel
}

function handleHideInput() {
  if (!parents?.length) return

  if (isPromotedWidgetView(widget)) {
    for (const parent of parents) {
      const source: PromotedWidgetSource = {
        sourceNodeId:
          String(node.id) === String(parent.id)
            ? widget.sourceNodeId
            : String(node.id),
        sourceWidgetName: widget.sourceWidgetName,
        disambiguatingSourceNodeId: widget.disambiguatingSourceNodeId
      }
      promotionStore.demote(parent.rootGraph.id, parent.id, source)
      parent.computeSize(parent.size)
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
    <template #default="{ close }">
      <Button
        variant="textonly"
        size="unset"
        class="flex w-full items-center justify-start gap-2 rounded-sm px-3 py-2 text-sm transition-all active:scale-95"
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
        v-if="canToggleVisibility"
        variant="textonly"
        size="unset"
        class="flex w-full items-center justify-start gap-2 rounded-sm px-3 py-2 text-sm transition-all active:scale-95"
        @click="
          () => {
            if (isShownOnParents) handleHideInput()
            else handleShowInput()
            close()
          }
        "
      >
        <template v-if="isShownOnParents">
          <i class="icon-[lucide--eye-off] size-4" />
          <span>{{ t('rightSidePanel.hideInput') }}</span>
        </template>
        <template v-else>
          <i class="icon-[lucide--eye] size-4" />
          <span>{{ t('rightSidePanel.showInput') }}</span>
        </template>
      </Button>

      <Button
        variant="textonly"
        size="unset"
        class="flex w-full items-center justify-start gap-2 rounded-sm px-3 py-2 text-sm transition-all active:scale-95"
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
        class="flex w-full items-center justify-start gap-2 rounded-sm px-3 py-2 text-sm transition-all active:scale-95"
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
