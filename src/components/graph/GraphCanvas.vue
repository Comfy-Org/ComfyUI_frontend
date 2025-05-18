<template>
  <!-- Load splitter overlay only after comfyApp is ready. -->
  <!-- If load immediately, the top-level splitter stateKey won't be correctly
  synced with the stateStorage (localStorage). -->
  <LiteGraphCanvasSplitterOverlay
    v-if="comfyAppReady && betaMenuEnabled && !workspaceStore.focusMode"
  >
    <template #side-bar-panel>
      <SideToolbar />
    </template>
    <template #bottom-panel>
      <BottomPanel />
    </template>
    <template #graph-canvas-panel>
      <SecondRowWorkflowTabs
        v-if="workflowTabsPosition === 'Topbar (2nd-row)'"
        class="pointer-events-auto"
      />
      <GraphCanvasMenu v-if="canvasMenuEnabled" class="pointer-events-auto" />
    </template>
  </LiteGraphCanvasSplitterOverlay>
  <GraphCanvasMenu v-if="!betaMenuEnabled && canvasMenuEnabled" />
  <canvas
    id="graph-canvas"
    ref="canvasRef"
    tabindex="1"
    class="w-full h-full touch-none"
  />

  <NodeTooltip v-if="tooltipEnabled" />
  <NodeSearchboxPopover />

  <!-- Initialize components after comfyApp is ready. useAbsolutePosition requires
  canvasStore.canvas to be initialized. -->
  <template v-if="comfyAppReady">
    <TitleEditor />
    <SelectionOverlay v-if="selectionToolboxEnabled">
      <SelectionToolbox />
    </SelectionOverlay>
    <DomWidgets />
  </template>
  <SubgraphBreadcrumb />
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import { useEventListener } from '@vueuse/core'
import { computed, onMounted, ref, watch, watchEffect } from 'vue'

import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import BottomPanel from '@/components/bottomPanel/BottomPanel.vue'
import SubgraphBreadcrumb from '@/components/breadcrumb/SubgraphBreadcrumb.vue'
import DomWidgets from '@/components/graph/DomWidgets.vue'
import GraphCanvasMenu from '@/components/graph/GraphCanvasMenu.vue'
import NodeTooltip from '@/components/graph/NodeTooltip.vue'
import SelectionOverlay from '@/components/graph/SelectionOverlay.vue'
import SelectionToolbox from '@/components/graph/SelectionToolbox.vue'
import TitleEditor from '@/components/graph/TitleEditor.vue'
import NodeSearchboxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import SideToolbar from '@/components/sidebar/SideToolbar.vue'
import SecondRowWorkflowTabs from '@/components/topbar/SecondRowWorkflowTabs.vue'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useNodeBadge } from '@/composables/node/useNodeBadge'
import { useCanvasDrop } from '@/composables/useCanvasDrop'
import { useContextMenuTranslation } from '@/composables/useContextMenuTranslation'
import { useCopy } from '@/composables/useCopy'
import { useGlobalLitegraph } from '@/composables/useGlobalLitegraph'
import { useLitegraphSettings } from '@/composables/useLitegraphSettings'
import { usePaste } from '@/composables/usePaste'
import { useWorkflowAutoSave } from '@/composables/useWorkflowAutoSave'
import { useWorkflowPersistence } from '@/composables/useWorkflowPersistence'
import { CORE_SETTINGS } from '@/constants/coreSettings'
import { i18n, t } from '@/i18n'
import type { NodeId } from '@/schemas/comfyWorkflowSchema'
import { UnauthorizedError, api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { IS_CONTROL_WIDGET, updateControlWidgetLabel } from '@/scripts/widgets'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useWorkflowService } from '@/services/workflowService'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

const emit = defineEmits<{
  ready: []
}>()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const settingStore = useSettingStore()
const nodeDefStore = useNodeDefStore()
const workspaceStore = useWorkspaceStore()
const canvasStore = useCanvasStore()
const executionStore = useExecutionStore()
const toastStore = useToastStore()
const betaMenuEnabled = computed(
  () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
)
const workflowTabsPosition = computed(() =>
  settingStore.get('Comfy.Workflow.WorkflowTabsPosition')
)
const canvasMenuEnabled = computed(() =>
  settingStore.get('Comfy.Graph.CanvasMenu')
)
const tooltipEnabled = computed(() => settingStore.get('Comfy.EnableTooltips'))
const selectionToolboxEnabled = computed(() =>
  settingStore.get('Comfy.Canvas.SelectionToolbox')
)

watchEffect(() => {
  nodeDefStore.showDeprecated = settingStore.get('Comfy.Node.ShowDeprecated')
})

watchEffect(() => {
  nodeDefStore.showExperimental = settingStore.get(
    'Comfy.Node.ShowExperimental'
  )
})

watchEffect(() => {
  const spellcheckEnabled = settingStore.get('Comfy.TextareaWidget.Spellcheck')
  const textareas = document.querySelectorAll<HTMLTextAreaElement>(
    'textarea.comfy-multiline-input'
  )

  textareas.forEach((textarea: HTMLTextAreaElement) => {
    textarea.spellcheck = spellcheckEnabled
    // Force recheck to ensure visual update
    textarea.focus()
    textarea.blur()
  })
})

watch(
  () => settingStore.get('Comfy.WidgetControlMode'),
  () => {
    if (!canvasStore.canvas) return

    for (const n of comfyApp.graph.nodes) {
      if (!n.widgets) continue
      for (const w of n.widgets) {
        // @ts-expect-error fixme ts strict error
        if (w[IS_CONTROL_WIDGET]) {
          updateControlWidgetLabel(w)
          if (w.linkedWidgets) {
            for (const l of w.linkedWidgets) {
              updateControlWidgetLabel(l)
            }
          }
        }
      }
    }
    comfyApp.graph.setDirtyCanvas(true)
  }
)

const colorPaletteService = useColorPaletteService()
const colorPaletteStore = useColorPaletteStore()
watch(
  [() => canvasStore.canvas, () => settingStore.get('Comfy.ColorPalette')],
  async ([canvas, currentPaletteId]) => {
    if (!canvas) return

    await colorPaletteService.loadColorPalette(currentPaletteId)
  }
)
watch(
  () => colorPaletteStore.activePaletteId,
  async (newValue) => {
    await settingStore.set('Comfy.ColorPalette', newValue)
  }
)

// Update the progress of the executing node
watch(
  () =>
    [executionStore.executingNodeId, executionStore.executingNodeProgress] as [
      NodeId | null,
      number | null
    ],
  ([executingNodeId, executingNodeProgress]) => {
    for (const node of comfyApp.graph.nodes) {
      if (node.id == executingNodeId) {
        node.progress = executingNodeProgress ?? undefined
      } else {
        node.progress = undefined
      }
    }
  }
)

// Update node slot errors
watch(
  () => executionStore.lastNodeErrors,
  (lastNodeErrors) => {
    const removeSlotError = (node: LGraphNode) => {
      for (const slot of node.inputs) {
        delete slot.hasErrors
      }
      for (const slot of node.outputs) {
        delete slot.hasErrors
      }
    }

    for (const node of comfyApp.graph.nodes) {
      removeSlotError(node)
      const nodeErrors = lastNodeErrors?.[node.id]
      if (!nodeErrors) continue
      for (const error of nodeErrors.errors) {
        if (error.extra_info && error.extra_info.input_name) {
          const inputIndex = node.findInputSlot(error.extra_info.input_name)
          if (inputIndex !== -1) {
            node.inputs[inputIndex].hasErrors = true
          }
        }
      }
    }

    comfyApp.canvas.draw(true, true)
  }
)

useEventListener(
  canvasRef,
  'litegraph:no-items-selected',
  () => {
    toastStore.add({
      severity: 'warn',
      summary: t('toastMessages.nothingSelected'),
      life: 2000
    })
  },
  { passive: true }
)

const loadCustomNodesI18n = async () => {
  try {
    const i18nData = await api.getCustomNodesI18n()
    Object.entries(i18nData).forEach(([locale, message]) => {
      i18n.global.mergeLocaleMessage(locale, message)
    })
  } catch (error) {
    console.error('Failed to load custom nodes i18n', error)
  }
}

const comfyAppReady = ref(false)
const workflowPersistence = useWorkflowPersistence()
// @ts-expect-error fixme ts strict error
useCanvasDrop(canvasRef)
useLitegraphSettings()
useNodeBadge()

onMounted(async () => {
  useGlobalLitegraph()
  useContextMenuTranslation()
  useCopy()
  usePaste()
  useWorkflowAutoSave()

  comfyApp.vueAppReady = true

  workspaceStore.spinner = true
  // ChangeTracker needs to be initialized before setup, as it will overwrite
  // some listeners of litegraph canvas.
  ChangeTracker.init()
  await loadCustomNodesI18n()
  try {
    await settingStore.loadSettingValues()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      console.log(
        'Failed loading user settings, user unauthorized, cleaning local Comfy.userId'
      )
      localStorage.removeItem('Comfy.userId')
      localStorage.removeItem('Comfy.userName')
      window.location.reload()
    } else {
      throw error
    }
  }
  CORE_SETTINGS.forEach((setting) => {
    settingStore.addSetting(setting)
  })
  // @ts-expect-error fixme ts strict error
  await comfyApp.setup(canvasRef.value)
  canvasStore.canvas = comfyApp.canvas
  canvasStore.canvas.render_canvas_border = false
  workspaceStore.spinner = false

  window.app = comfyApp
  window.graph = comfyApp.graph

  comfyAppReady.value = true

  comfyApp.canvas.onSelectionChange = useChainCallback(
    comfyApp.canvas.onSelectionChange,
    () => canvasStore.updateSelectedItems()
  )

  // Load color palette
  colorPaletteStore.customPalettes = settingStore.get(
    'Comfy.CustomColorPalettes'
  )

  // Restore workflow and workflow tabs state from storage
  await workflowPersistence.restorePreviousWorkflow()
  workflowPersistence.restoreWorkflowTabsState()

  // Start watching for locale change after the initial value is loaded.
  watch(
    () => settingStore.get('Comfy.Locale'),
    async () => {
      await useCommandStore().execute('Comfy.RefreshNodeDefinitions')
      await useWorkflowService().reloadCurrentWorkflow()
    }
  )

  emit('ready')
})
</script>
