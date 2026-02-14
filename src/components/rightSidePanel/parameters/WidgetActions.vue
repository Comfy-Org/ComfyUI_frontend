<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MoreButton from '@/components/button/MoreButton.vue'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import {
  demoteWidget,
  promoteWidget
} from '@/core/graph/subgraph/proxyWidgetUtils'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDialogService } from '@/services/dialogService'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'

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

const label = defineModel<string>('label', { required: true })

const canvasStore = useCanvasStore()
const favoritedWidgetsStore = useFavoritedWidgetsStore()
const dialogService = useDialogService()
const { t } = useI18n()

const hasParents = computed(() => parents?.length > 0)
const favoriteNode = computed(() =>
  isShownOnParents && hasParents.value ? parents[0] : node
)
const isFavorited = computed(() =>
  favoritedWidgetsStore.isFavorited(favoriteNode.value, widget.name)
)

async function handleRename() {
  const newLabel = await dialogService.prompt({
    title: t('g.rename'),
    message: t('g.enterNewNamePrompt'),
    defaultValue: widget.label,
    placeholder: widget.name
  })

  if (newLabel === null) return
  label.value = newLabel
}

function handleHideInput() {
  if (!parents?.length) return

  if (isPromotedWidgetView(widget)) {
    const subgraph = parents[0].subgraph
    const interiorNode = subgraph.getNodeById(widget.sourceNodeId)

    if (!interiorNode) {
      console.error('Could not find interior node for promoted widget')
      return
    }

    const originalWidget = interiorNode.widgets?.find(
      (w) => w.name === widget.sourceWidgetName
    )

    if (!originalWidget) {
      console.error('Could not find original widget for promoted widget')
      return
    }

    demoteWidget(interiorNode, originalWidget, parents)
  } else {
    // For regular widgets (not yet promoted), use them directly
    demoteWidget(node, widget, parents)
  }

  canvasStore.canvas?.setDirty(true, true)
}

function handleShowInput() {
  if (!parents?.length) return

  promoteWidget(node, widget, parents)
  canvasStore.canvas?.setDirty(true, true)
}

function handleToggleFavorite() {
  favoritedWidgetsStore.toggleFavorite(favoriteNode.value, widget.name)
}

const buttonClasses = cn([
  'border-none bg-transparent',
  'w-full flex items-center gap-2 rounded px-3 py-2 text-sm',
  'cursor-pointer transition-all hover:bg-secondary-background-hover active:scale-95'
])
</script>

<template>
  <MoreButton
    is-vertical
    class="text-muted-foreground bg-transparent hover:text-base-foreground hover:bg-secondary-background-hover active:scale-95 transition-all"
  >
    <template #default="{ close }">
      <button
        :class="buttonClasses"
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
        v-if="hasParents"
        :class="buttonClasses"
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
      </button>

      <button
        :class="buttonClasses"
        @click="
          () => {
            handleToggleFavorite()
            close()
          }
        "
      >
        <template v-if="isFavorited">
          <i class="icon-[lucide--star]" />
          <span>{{ t('rightSidePanel.removeFavorite') }}</span>
        </template>
        <template v-else>
          <i class="icon-[lucide--star]" />
          <span>{{ t('rightSidePanel.addFavorite') }}</span>
        </template>
      </button>
    </template>
  </MoreButton>
</template>
