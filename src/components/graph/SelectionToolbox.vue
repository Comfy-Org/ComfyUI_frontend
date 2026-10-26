<template>
  <div
    ref="toolboxRef"
    style="transform: translate(var(--tb-x), var(--tb-y))"
    class="pointer-events-none fixed top-0 left-0 z-40"
  >
    <Transition name="slide-up">
      <div
        v-if="visible"
        data-testid="selection-toolbox"
        class="selection-toolbox pointer-events-auto floating-panel"
        @wheel="canvasInteractions.forwardEventToCanvas"
      >
        <TooltipProvider :delay-duration="1000">
          <div class="flex h-8 gap-1">
            <template v-if="hasLinkSelection">
              <Button
                v-if="linksHidden"
                :tooltip="$t('commands.Comfy_Canvas_ShowSelectedLinks.label')"
                variant="muted-textonly"
                :aria-label="
                  $t('commands.Comfy_Canvas_ShowSelectedLinks.label')
                "
                data-testid="show-links-button"
                @click="commandStore.execute('Comfy.Canvas.ShowSelectedLinks')"
              >
                <i class="icon-[lucide--eye]" />
              </Button>
              <Button
                v-else
                :tooltip="$t('commands.Comfy_Canvas_HideSelectedLinks.label')"
                variant="muted-textonly"
                :aria-label="
                  $t('commands.Comfy_Canvas_HideSelectedLinks.label')
                "
                data-testid="hide-links-button"
                @click="commandStore.execute('Comfy.Canvas.HideSelectedLinks')"
              >
                <i class="icon-[lucide--eye-off]" />
              </Button>
              <Button
                :tooltip="$t('commands.Comfy_Canvas_DeleteSelectedLinks.label')"
                variant="muted-textonly"
                :aria-label="
                  $t('commands.Comfy_Canvas_DeleteSelectedLinks.label')
                "
                data-testid="delete-links-button"
                @click="
                  commandStore.execute('Comfy.Canvas.DeleteSelectedLinks')
                "
              >
                <i class="icon-[lucide--trash-2]" />
              </Button>
            </template>
            <template v-else>
              <Button
                v-if="isDeletable"
                :tooltip="$t('commands.Comfy_Canvas_DeleteSelectedItems.label')"
                variant="muted-textonly"
                :aria-label="
                  $t('commands.Comfy_Canvas_DeleteSelectedItems.label')
                "
                data-testid="delete-button"
                @click="
                  commandStore.execute('Comfy.Canvas.DeleteSelectedItems')
                "
              >
                <i class="icon-[lucide--trash-2]" />
              </Button>
              <VerticalDivider v-if="canOpenNodeInfo && hasAnySelection" />
              <Button
                v-if="canOpenNodeInfo"
                :tooltip="$t('g.info')"
                data-testid="info-button"
                variant="muted-textonly"
                :aria-label="$t('g.info')"
                @click="onInfoClick"
              >
                <i class="icon-[lucide--info]" />
              </Button>

              <ColorPickerButton v-if="hasAnySelection" />
              <ArrangeButton v-if="hasMultipleSelection" />
              <Button
                v-if="hasMultipleSelection"
                :tooltip="$t('g.frameNodes')"
                variant="muted-textonly"
                :aria-label="$t('g.frameNodes')"
                @click="frameNodes"
              >
                <i class="icon-[lucide--frame]" />
              </Button>
              <Button
                v-if="isSingleSubgraph"
                :tooltip="$t('commands.Comfy_Graph_UnpackSubgraph.label')"
                variant="muted-textonly"
                :aria-label="$t('commands.Comfy_Graph_UnpackSubgraph.label')"
                data-testid="convert-to-subgraph-button"
                @click="commandStore.execute('Comfy.Graph.UnpackSubgraph')"
              >
                <i class="icon-[lucide--expand]" />
              </Button>
              <Button
                v-else-if="hasAnySelection"
                :tooltip="$t('commands.Comfy_Graph_ConvertToSubgraph.label')"
                variant="muted-textonly"
                size="icon"
                :aria-label="$t('commands.Comfy_Graph_ConvertToSubgraph.label')"
                data-testid="convert-to-subgraph-button"
                @click="commandStore.execute('Comfy.Graph.ConvertToSubgraph')"
              >
                <i class="icon-[lucide--shrink]" />
              </Button>
              <template v-if="isSingleSubgraph">
                <Button
                  :tooltip="
                    $t('commands.Comfy_Graph_EditSubgraphWidgets.label')
                  "
                  variant="muted-textonly"
                  :aria-label="
                    $t('commands.Comfy_Graph_EditSubgraphWidgets.label')
                  "
                  @click="rightSidePanelStore.openPanel('subgraph')"
                >
                  <i class="icon-[lucide--settings-2]" />
                </Button>
                <Button
                  :tooltip="$t('commands.Comfy_PublishSubgraph.label')"
                  variant="muted-textonly"
                  :aria-label="$t('commands.Comfy_PublishSubgraph.label')"
                  @click="commandStore.execute('Comfy.PublishSubgraph')"
                >
                  <i class="icon-[lucide--book-open]" />
                </Button>
              </template>
              <Button
                v-if="isSingleImageNode"
                :tooltip="$t('commands.Comfy_MaskEditor_OpenMaskEditor.label')"
                variant="muted-textonly"
                :aria-label="
                  $t('commands.Comfy_MaskEditor_OpenMaskEditor.label')
                "
                @click="commandStore.execute('Comfy.MaskEditor.OpenMaskEditor')"
              >
                <i class="icon-[comfy--mask]" />
              </Button>
              <VerticalDivider v-if="hasAnySelection && showBypass" />

              <Button
                v-if="showBypass"
                :tooltip="
                  $t('commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label')
                "
                variant="muted-textonly"
                :aria-label="
                  $t('commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label')
                "
                data-testid="bypass-button"
                class="hover:bg-secondary"
                @click="
                  commandStore.execute(
                    'Comfy.Canvas.ToggleSelectedNodes.Bypass'
                  )
                "
              >
                <i class="icon-[lucide--redo-dot]" />
              </Button>
              <Button
                v-if="hasAnySelection && isRefreshable"
                :tooltip="$t('g.refreshNode')"
                variant="muted-textonly"
                :aria-label="$t('g.refreshNode')"
                data-testid="refresh-button"
                @click="refreshSelected"
              >
                <i class="icon-[lucide--refresh-cw]" />
              </Button>
              <Button
                v-if="hasAny3DNodeSelected"
                :tooltip="$t('commands.Comfy_3DViewer_Open3DViewer.label')"
                variant="muted-textonly"
                :aria-label="$t('commands.Comfy_3DViewer_Open3DViewer.label')"
                @click="commandStore.execute('Comfy.3DViewer.Open3DViewer')"
              >
                <i class="icon-[lucide--pencil]" />
              </Button>

              <Button
                v-for="command in extensionToolboxCommands"
                :key="command.id"
                :tooltip="
                  st(`commands.${normalizeI18nKey(command.id)}.label`, '')
                "
                variant="muted-textonly"
                :aria-label="
                  st(`commands.${normalizeI18nKey(command.id)}.label`, '')
                "
                @click="commandStore.execute(command.id)"
              >
                <i :class="command.icon" />
              </Button>
              <ExecuteButton v-if="hasOutputNodesSelected" />
              <Button
                :tooltip="$t('g.moreOptions')"
                data-testid="more-options-button"
                variant="muted-textonly"
                :aria-label="$t('g.moreOptions')"
                @click="toggleNodeOptions"
              >
                <i class="icon-[lucide--more-vertical]" />
              </Button>
            </template>
          </div>
        </TooltipProvider>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import ArrangeButton from '@/components/graph/selectionToolbox/ArrangeButton.vue'
import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import ExecuteButton from '@/components/graph/selectionToolbox/ExecuteButton.vue'
import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import { useSelectionToolboxPosition } from '@/composables/canvas/useSelectionToolboxPosition'
import { useFrameNodes } from '@/composables/graph/useFrameNodes'
import { toggleNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useRefreshableSelection } from '@/composables/useRefreshableSelection'
import { st } from '@/i18n'
import { areSelectedLinksHidden } from '@/lib/litegraph/src/canvas/linkSelection'
import { useTelemetry } from '@/platform/telemetry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useExtensionService } from '@/services/extensionService'
import { useCommandStore } from '@/stores/commandStore'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'
import type { ComfyCommandImpl } from '@/stores/commandStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

import VerticalDivider from '@comfyorg/design-system/common/VerticalDivider'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const extensionService = useExtensionService()
const canvasInteractions = useCanvasInteractions()
const linkSelectionStore = useLinkSelectionStore()
const rightSidePanelStore = useRightSidePanelStore()
const { frameNodes } = useFrameNodes()
const { isRefreshable, refreshSelected } = useRefreshableSelection()

const toolboxRef = ref<HTMLElement | undefined>()
const { visible } = useSelectionToolboxPosition(toolboxRef)

const extensionToolboxCommands = computed<ComfyCommandImpl[]>(() => {
  const commandIds = new Set<string>(
    canvasStore.selectedItems
      .map(
        (item) =>
          extensionService
            .invokeExtensions('getSelectionToolboxCommands', item)
            .flat() as string[]
      )
      .flat()
  )
  return Array.from(commandIds)
    .map((commandId) => commandStore.getCommand(commandId))
    .filter((command): command is ComfyCommandImpl => command !== undefined)
})

const {
  selectedItems,
  hasAnySelection,
  hasGroupedNodesSelection,
  hasMultipleSelection,
  isSingleNode,
  isSingleSubgraph,
  isSingleImageNode,
  hasAny3DNodeSelected,
  hasOutputNodesSelected,
  canOpenNodeInfo,
  openNodeInfo
} = useSelectionState()

const showBypass = computed(
  () =>
    isSingleNode.value ||
    isSingleSubgraph.value ||
    hasMultipleSelection.value ||
    hasGroupedNodesSelection.value
)
const hasLinkSelection = computed(
  () => !hasAnySelection.value && linkSelectionStore.selection !== null
)

const isDeletable = computed(() =>
  selectedItems.value.some((item) => item.removable !== false)
)

const linksHidden = computed(() => {
  if (!linkSelectionStore.selection) return false
  const graph = canvasStore.canvas?.graph
  return !!graph && areSelectedLinksHidden(graph)
})

function onInfoClick() {
  if (!openNodeInfo()) return

  useTelemetry()?.trackUiButtonClicked({
    button_id: 'selection_toolbox_node_info_opened',
    element_group: 'selection_toolbox'
  })
}
</script>

<style scoped>
.selection-toolbox {
  transform: translateX(-50%) translateY(-120%);
}

@keyframes slideUp {
  0% {
    transform: translateX(-50%) translateY(-100%);
    opacity: 0;
  }
  50% {
    transform: translateX(-50%) translateY(-125%);
    opacity: 0.5;
  }
  100% {
    transform: translateX(-50%) translateY(-120%);
    opacity: 1;
  }
}

.slide-up-enter-active {
  animation: slideUp 125ms ease-out;
}

.slide-up-leave-active {
  animation: slideUp 25ms ease-out reverse;
}
</style>
