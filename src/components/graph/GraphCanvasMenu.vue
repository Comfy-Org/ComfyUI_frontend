<template>
  <div>
    <ZoomControlsModal :visible="isModalVisible" @close="hideModal" />

    <!-- Backdrop -->
    <div
      v-if="hasActivePopup"
      class="fixed inset-0 z-1200"
      @click="hideModal"
    ></div>

    <!-- Right-anchoring alone lets a toolbar wider than the canvas overhang its
         left edge and cover the sidebar. Spanning the canvas and pushing with an
         auto margin pins the toolbar to the right instead, and the width cap keeps
         any overflow inside the canvas as a scroll. -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-1200 flex">
      <ButtonGroup
        role="toolbar"
        :aria-label="t('graphCanvasMenu.canvasToolbar')"
        class="pointer-events-auto ml-auto max-w-full min-w-0 flex-row gap-1 overflow-x-auto floating-panel"
        @wheel="canvasInteractions.handleWheel"
      >
        <CanvasModeSelector
          :button-styles="stringifiedMinimapStyles.buttonStyles"
        />

        <div class="h-[27px] w-px self-center bg-node-divider" />

        <Button
          v-tooltip.top="fitViewTooltip"
          variant="secondary"
          :aria-label="fitViewTooltip"
          :style="stringifiedMinimapStyles.buttonStyles"
          class="size-8 bg-transparent p-0 hover:bg-interface-button-hover-surface"
          @click="() => commandStore.execute('Comfy.Canvas.FitView')"
        >
          <i class="icon-[lucide--focus] size-4" aria-hidden="true" />
        </Button>

        <Button
          v-tooltip.top="t('zoomControls.label')"
          variant="secondary"
          :class="
            cn(
              'h-8 w-15 bg-transparent p-0 hover:bg-interface-button-hover-surface',
              isModalVisible && 'not-active:bg-interface-panel-selected-surface'
            )
          "
          :aria-label="t('zoomControls.label')"
          data-testid="zoom-controls-button"
          :style="stringifiedMinimapStyles.buttonStyles"
          @click="toggleModal"
        >
          <span class="inline-flex items-center gap-1 px-2 text-xs">
            <span>{{ canvasStore.appScalePercentage }}%</span>
            <i class="icon-[lucide--chevron-down] size-4" aria-hidden="true" />
          </span>
        </Button>

        <div class="h-[27px] w-px self-center bg-node-divider" />

        <Button
          v-tooltip.top="minimapTooltip"
          variant="secondary"
          :aria-label="minimapTooltip"
          data-testid="toggle-minimap-button"
          :style="stringifiedMinimapStyles.buttonStyles"
          :class="
            cn(
              'size-8 bg-transparent p-0 hover:bg-interface-button-hover-surface',
              settingStore.get('Comfy.Minimap.Visible') &&
                'not-active:bg-interface-panel-selected-surface'
            )
          "
          @click="onMinimapToggleClick"
        >
          <i class="icon-[lucide--map] size-4" aria-hidden="true" />
        </Button>

        <Button
          v-tooltip.top="{
            value: linkVisibilityTooltip,
            pt: {
              root: {
                style: 'z-index: 2; transform: translateY(-20px);'
              }
            }
          }"
          variant="secondary"
          :class="
            cn(
              'size-8 bg-transparent p-0 hover:bg-interface-button-hover-surface',
              linkHidden && 'not-active:bg-interface-panel-selected-surface'
            )
          "
          :aria-label="linkVisibilityAriaLabel"
          data-testid="toggle-link-visibility-button"
          :style="stringifiedMinimapStyles.buttonStyles"
          @click="onLinkVisibilityToggleClick"
        >
          <i class="icon-[lucide--route-off] size-4" aria-hidden="true" />
        </Button>
      </ButtonGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import ButtonGroup from 'primevue/buttongroup'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useZoomControls } from '@/composables/useZoomControls'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'
import { useCommandStore } from '@/stores/commandStore'
import { cn } from '@comfyorg/tailwind-utils'

import CanvasModeSelector from './CanvasModeSelector.vue'
import ZoomControlsModal from './modals/ZoomControlsModal.vue'

const { t } = useI18n()
const commandStore = useCommandStore()
const { formatKeySequence } = useCommandStore()
const canvasStore = useCanvasStore()
const settingStore = useSettingStore()
const canvasInteractions = useCanvasInteractions()
const minimap = useMinimap()

const { isModalVisible, toggleModal, hideModal, hasActivePopup } =
  useZoomControls()

const stringifiedMinimapStyles = computed(() => {
  const buttonKeys = ['borderRadius']
  const additionalButtonStyles = {
    border: 'none'
  }

  const containerStyles = minimap.containerStyles.value

  const buttonStyles = {
    ...Object.fromEntries(
      Object.entries(containerStyles).filter(([key]) =>
        buttonKeys.includes(key)
      )
    ),
    ...additionalButtonStyles
  }
  return { buttonStyles }
})

// Computed properties for reactive states
const linkHidden = computed(
  () => settingStore.get('Comfy.LinkRenderMode') === LiteGraph.HIDDEN_LINK
)

// Computed properties for command text
const fitViewCommandText = computed(() =>
  formatKeySequence(
    commandStore.getCommand('Comfy.Canvas.FitView')
  ).toUpperCase()
)
const minimapCommandText = computed(() =>
  formatKeySequence(
    commandStore.getCommand('Comfy.Canvas.ToggleMinimap')
  ).toUpperCase()
)

// Computed properties for tooltip and aria-label texts
const fitViewTooltip = computed(() => {
  const label = t('graphCanvasMenu.fitView')
  const shortcut = fitViewCommandText.value
  return shortcut ? `${label} (${shortcut})` : label
})
const minimapTooltip = computed(() => {
  const label = settingStore.get('Comfy.Minimap.Visible')
    ? t('zoomControls.hideMinimap')
    : t('zoomControls.showMinimap')
  const shortcut = minimapCommandText.value
  return shortcut ? `${label} (${shortcut})` : label
})
const linkVisibilityTooltip = computed(() =>
  linkHidden.value
    ? t('graphCanvasMenu.showLinks')
    : t('graphCanvasMenu.hideLinks')
)
const linkVisibilityAriaLabel = computed(() =>
  linkHidden.value
    ? t('graphCanvasMenu.showLinks')
    : t('graphCanvasMenu.hideLinks')
)
onMounted(() => {
  canvasStore.initScaleSync()
})

/**
 * Track minimap toggle button click and execute the command.
 */
const onMinimapToggleClick = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'graph_menu_minimap_toggle_clicked',
    element_group: 'graph_menu'
  })
  void commandStore.execute('Comfy.Canvas.ToggleMinimap')
}

/**
 * Track hide/show links button click and execute the command.
 */
const onLinkVisibilityToggleClick = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'graph_menu_hide_links_toggle_clicked',
    element_group: 'graph_menu'
  })
  void commandStore.execute('Comfy.Canvas.ToggleLinkVisibility')
}

onBeforeUnmount(() => {
  canvasStore.cleanupScaleSync()
})
</script>
