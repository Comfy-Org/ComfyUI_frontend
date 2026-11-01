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
              <LinkDestinationButton />
              <ToolboxButton
                v-if="linksHidden"
                :label="$t('commands.Comfy_Canvas_ShowSelectedLinks.label')"
                icon="icon-[lucide--eye]"
                @click="commandStore.execute('Comfy.Canvas.ShowSelectedLinks')"
              />
              <ToolboxButton
                v-else
                :label="$t('commands.Comfy_Canvas_HideSelectedLinks.label')"
                icon="icon-[lucide--eye-off]"
                @click="commandStore.execute('Comfy.Canvas.HideSelectedLinks')"
              />
              <ToolboxButton
                :label="$t('commands.Comfy_Canvas_DeleteSelectedLinks.label')"
                icon="icon-[lucide--trash-2]"
                @click="
                  commandStore.execute('Comfy.Canvas.DeleteSelectedLinks')
                "
              />
            </template>
            <template v-else>
              <ToolboxButton
                v-if="isDeletable"
                :label="$t('commands.Comfy_Canvas_DeleteSelectedItems.label')"
                icon="icon-[lucide--trash-2]"
                @click="
                  commandStore.execute('Comfy.Canvas.DeleteSelectedItems')
                "
              />
              <VerticalDivider v-if="canOpenNodeInfo && hasAnySelection" />
              <ToolboxButton
                v-if="canOpenNodeInfo"
                :label="$t('g.info')"
                icon="icon-[lucide--info]"
                @click="onInfoClick"
              />

              <ColorPickerButton v-if="hasAnySelection" />
              <ArrangeButton v-if="hasMultipleSelection" />
              <ToolboxButton
                v-if="hasMultipleSelection"
                :label="$t('g.frameNodes')"
                icon="icon-[lucide--frame]"
                @click="frameNodes"
              />
              <ToolboxButton
                v-if="isSingleSubgraph"
                :label="$t('commands.Comfy_Graph_UnpackSubgraph.label')"
                icon="icon-[lucide--expand]"
                @click="commandStore.execute('Comfy.Graph.UnpackSubgraph')"
              />
              <ToolboxButton
                v-else-if="hasAnySelection"
                :label="$t('commands.Comfy_Graph_ConvertToSubgraph.label')"
                icon="icon-[lucide--shrink]"
                size="icon"
                @click="commandStore.execute('Comfy.Graph.ConvertToSubgraph')"
              />
              <template v-if="isSingleSubgraph">
                <ToolboxButton
                  :label="$t('commands.Comfy_Graph_EditSubgraphWidgets.label')"
                  icon="icon-[lucide--settings-2]"
                  @click="rightSidePanelStore.openPanel('subgraph')"
                />
                <ToolboxButton
                  :label="$t('commands.Comfy_PublishSubgraph.label')"
                  icon="icon-[lucide--book-open]"
                  @click="commandStore.execute('Comfy.PublishSubgraph')"
                />
              </template>
              <ToolboxButton
                v-if="isSingleImageNode"
                :label="$t('commands.Comfy_MaskEditor_OpenMaskEditor.label')"
                icon="icon-[comfy--mask]"
                @click="commandStore.execute('Comfy.MaskEditor.OpenMaskEditor')"
              />
              <VerticalDivider v-if="hasAnySelection && showBypass" />

              <ToolboxButton
                v-if="showBypass"
                :label="
                  $t('commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label')
                "
                icon="icon-[lucide--redo-dot]"
                class="hover:bg-secondary"
                @click="
                  commandStore.execute(
                    'Comfy.Canvas.ToggleSelectedNodes.Bypass'
                  )
                "
              />
              <ToolboxButton
                v-if="hasAnySelection && isRefreshable"
                :label="$t('g.refreshNode')"
                icon="icon-[lucide--refresh-cw]"
                @click="refreshSelected"
              />
              <ToolboxButton
                v-if="hasAny3DNodeSelected"
                :label="$t('commands.Comfy_3DViewer_Open3DViewer.label')"
                icon="icon-[lucide--pencil]"
                @click="commandStore.execute('Comfy.3DViewer.Open3DViewer')"
              />

              <ToolboxButton
                v-for="command in extensionToolboxCommands"
                :key="command.id"
                :label="
                  st(
                    `commands.${normalizeI18nKey(command.id)}.label`,
                    command.label ?? ''
                  )
                "
                :icon="command.icon"
                @click="commandStore.execute(command.id)"
              />
              <ExecuteButton v-if="hasOutputNodesSelected" />
              <ToolboxButton
                :label="$t('g.moreOptions')"
                icon="icon-[lucide--more-vertical]"
                @click="toggleNodeOptions"
              />
            </template>
          </div>
        </TooltipProvider>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import ArrangeButton from '@/components/graph/selectionToolbox/ArrangeButton.vue'
import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import ExecuteButton from '@/components/graph/selectionToolbox/ExecuteButton.vue'
import LinkDestinationButton from '@/components/graph/selectionToolbox/LinkDestinationButton.vue'
import ToolboxButton from '@/components/graph/selectionToolbox/ToolboxButton.vue'
import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import { useSelectionToolboxPosition } from '@/composables/canvas/useSelectionToolboxPosition'
import { useFrameNodes } from '@/composables/graph/useFrameNodes'
import { toggleNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useRefreshableSelection } from '@/composables/useRefreshableSelection'
import { st } from '@/i18n'
import { areSelectedLinksHidden } from '@/lib/litegraph/src/canvas/linkSelection'
import { useTelemetry } from '@comfyorg/telemetry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useExtensionService } from '@/platform/extensions/services/extensionService'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'
import type { ComfyCommandImpl } from '@comfyorg/keybindings/commandStore'
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
