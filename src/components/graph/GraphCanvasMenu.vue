<template>
  <div>
    <ZoomControlsModal :visible="isModalVisible" />

    <!-- Backdrop -->
    <div
      v-if="hasActivePopup"
      class="fixed inset-0 z-1200"
      @click="hideModal"
    ></div>

    <ButtonGroup
      class="p-buttongroup-vertical p-1 absolute bottom-4 right-2 md:right-4"
      :style="stringifiedMinimapStyles.buttonGroupStyles"
      @wheel="canvasInteractions.handleWheel"
    >
      <Button
        v-tooltip.top="selectTooltip"
        :style="stringifiedMinimapStyles.buttonStyles"
        severity="secondary"
        :aria-label="selectTooltip"
        :pressed="isCanvasReadOnly"
        icon="i-material-symbols:pan-tool-outline"
        :class="selectButtonClass"
        @click="() => commandStore.execute('Comfy.Canvas.Unlock')"
      >
        <template #icon>
          <i-lucide:mouse-pointer-2 />
        </template>
      </Button>

      <Button
        v-tooltip.top="handTooltip"
        severity="secondary"
        :aria-label="handTooltip"
        :pressed="isCanvasUnlocked"
        :class="handButtonClass"
        :style="stringifiedMinimapStyles.buttonStyles"
        @click="() => commandStore.execute('Comfy.Canvas.Lock')"
      >
        <template #icon>
          <i-lucide:hand />
        </template>
      </Button>

      <!-- vertical line with bg E1DED5 -->
      <div class="w-px my-1 bg-[#E1DED5] dark-theme:bg-[#2E3037] mx-2" />

      <Button
        v-tooltip.top="fitViewTooltip"
        severity="secondary"
        icon="pi pi-expand"
        :aria-label="fitViewTooltip"
        :style="stringifiedMinimapStyles.buttonStyles"
        class="dark-theme:hover:bg-[#444444]! hover:bg-[#E7E6E6]!"
        @click="() => commandStore.execute('Comfy.Canvas.FitView')"
      >
        <template #icon>
          <i-lucide:focus />
        </template>
      </Button>

      <Button
        ref="zoomButton"
        v-tooltip.top="t('zoomControls.label')"
        severity="secondary"
        :label="t('zoomControls.label')"
        :class="zoomButtonClass"
        :aria-label="t('zoomControls.label')"
        data-testid="zoom-controls-button"
        :style="stringifiedMinimapStyles.buttonStyles"
        @click="toggleModal"
      >
        <span class="inline-flex text-xs">
          <span>{{ canvasStore.appScalePercentage }}%</span>
          <i-lucide:chevron-down />
        </span>
      </Button>

      <div class="w-px my-1 bg-[#E1DED5] dark-theme:bg-[#2E3037] mx-2" />

      <Button
        ref="focusButton"
        v-tooltip.top="focusModeTooltip"
        severity="secondary"
        :aria-label="focusModeTooltip"
        data-testid="focus-mode-button"
        :style="stringifiedMinimapStyles.buttonStyles"
        :class="focusButtonClass"
        @click="() => commandStore.execute('Workspace.ToggleFocusMode')"
      >
        <template #icon>
          <i-lucide:lightbulb />
        </template>
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
        severity="secondary"
        :class="linkVisibleClass"
        :aria-label="linkVisibilityAriaLabel"
        data-testid="toggle-link-visibility-button"
        :style="stringifiedMinimapStyles.buttonStyles"
        @click="() => commandStore.execute('Comfy.Canvas.ToggleLinkVisibility')"
      >
        <template #icon>
          <i-lucide:route-off />
        </template>
      </Button>
    </ButtonGroup>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ButtonGroup from 'primevue/buttongroup'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCanvasInteractions } from '@/composables/graph/useCanvasInteractions'
import { useZoomControls } from '@/composables/useZoomControls'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'
import { useCommandStore } from '@/stores/commandStore'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

import ZoomControlsModal from './modals/ZoomControlsModal.vue'

const { t } = useI18n()
const commandStore = useCommandStore()
const { formatKeySequence } = useCommandStore()
const canvasStore = useCanvasStore()
const settingStore = useSettingStore()
const canvasInteractions = useCanvasInteractions()
const workspaceStore = useWorkspaceStore()
const minimap = useMinimap()

const { isModalVisible, toggleModal, hideModal, hasActivePopup } =
  useZoomControls()

const stringifiedMinimapStyles = computed(() => {
  const buttonGroupKeys = ['backgroundColor', 'borderRadius', '']
  const buttonKeys = ['backgroundColor', 'borderRadius']
  const additionalButtonStyles = {
    border: 'none',
    width: '35px',
    height: '35px',
    'margin-right': '2px',
    'margin-left': '2px'
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
  const buttonGroupStyles = Object.entries(containerStyles)
    .filter(([key]) => buttonGroupKeys.includes(key))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})

  return { buttonStyles, buttonGroupStyles }
})

// Computed properties for reactive states
const isCanvasReadOnly = computed(() => canvasStore.canvas?.read_only ?? false)
const isCanvasUnlocked = computed(() => !isCanvasReadOnly.value)
const linkHidden = computed(
  () => settingStore.get('Comfy.LinkRenderMode') === LiteGraph.HIDDEN_LINK
)

// Computed properties for command text
const unlockCommandText = computed(() =>
  formatKeySequence(
    commandStore.getCommand('Comfy.Canvas.Unlock')
  ).toUpperCase()
)
const lockCommandText = computed(() =>
  formatKeySequence(commandStore.getCommand('Comfy.Canvas.Lock')).toUpperCase()
)
const fitViewCommandText = computed(() =>
  formatKeySequence(
    commandStore.getCommand('Comfy.Canvas.FitView')
  ).toUpperCase()
)
const focusCommandText = computed(() =>
  formatKeySequence(
    commandStore.getCommand('Workspace.ToggleFocusMode')
  ).toUpperCase()
)

// Computed properties for button classes and states
const selectButtonClass = computed(() =>
  isCanvasUnlocked.value
    ? 'not-active:dark-theme:bg-[#262729]! not-active:bg-[#E7E6E6]!'
    : ''
)

const handButtonClass = computed(() =>
  isCanvasReadOnly.value
    ? 'not-active:dark-theme:bg-[#262729]! not-active:bg-[#E7E6E6]!'
    : ''
)

const zoomButtonClass = computed(() => [
  'w-16!',
  isModalVisible.value
    ? 'not-active:dark-theme:bg-[#262729]! not-active:bg-[#E7E6E6]!'
    : '',
  'dark-theme:hover:bg-[#262729]! hover:bg-[#E7E6E6]!'
])

const focusButtonClass = computed(() => ({
  'dark-theme:hover:bg-[#262729]! hover:bg-[#E7E6E6]!': true,
  'not-active:dark-theme:bg-[#262729]! not-active:bg-[#E7E6E6]!':
    workspaceStore.focusMode
}))

// Computed properties for tooltip and aria-label texts
const selectTooltip = computed(
  () => `${t('graphCanvasMenu.select')} (${unlockCommandText.value})`
)
const handTooltip = computed(
  () => `${t('graphCanvasMenu.hand')} (${lockCommandText.value})`
)
const fitViewTooltip = computed(
  () => `${t('graphCanvasMenu.fitView')} (${fitViewCommandText.value})`
)
const focusModeTooltip = computed(
  () => `${t('graphCanvasMenu.focusMode')} (${focusCommandText.value})`
)
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
const linkVisibleClass = computed(() => [
  linkHidden.value
    ? 'not-active:dark-theme:bg-[#262729]! not-active:bg-[#E7E6E6]!'
    : '',
  'dark-theme:hover:bg-[#262729]! hover:bg-[#E7E6E6]!'
])

onMounted(() => {
  canvasStore.initScaleSync()
})

onBeforeUnmount(() => {
  canvasStore.cleanupScaleSync()
})
</script>

<style scoped>
.p-buttongroup-vertical {
  display: flex;
  flex-direction: row;
  z-index: 1200;
  border-radius: var(--p-button-border-radius);
  overflow: hidden;
  border: 1px solid var(--p-panel-border-color);
}

.p-buttongroup-vertical .p-button {
  margin: 0;
  border-radius: 0;
}
</style>
