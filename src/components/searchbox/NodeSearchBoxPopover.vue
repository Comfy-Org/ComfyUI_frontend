<template>
  <div>
    <Dialog
      v-model:visible="visible"
      modal
      :dismissable-mask="dismissable"
      :pt="{
        root: {
          class: 'invisible-dialog-root',
          role: 'search'
        },
        mask: { class: 'node-search-box-dialog-mask' },
        transition: {
          enterFromClass: 'opacity-0 scale-75',
          // 100ms is the duration of the transition in the dialog component
          enterActiveClass: 'transition-all duration-100 ease-out',
          leaveActiveClass: 'transition-all duration-100 ease-in',
          leaveToClass: 'opacity-0 scale-75'
        }
      }"
      @hide="clearFilters"
    >
      <template #container>
        <NodeSearchBox
          :filters="nodeFilters"
          @add-filter="addFilter"
          @remove-filter="removeFilter"
          @add-node="addNode"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import {
  LGraphNode,
  LiteGraph,
  LiteGraphCanvasEvent
} from '@comfyorg/litegraph'
import { Point } from '@comfyorg/litegraph/dist/interfaces'
import type { CanvasPointerEvent } from '@comfyorg/litegraph/dist/types/events'
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import Dialog from 'primevue/dialog'
import { computed, ref, toRaw, watch, watchEffect } from 'vue'

import { useLitegraphService } from '@/services/litegraphService'
import { useCanvasStore } from '@/stores/graphStore'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useSearchBoxStore } from '@/stores/workspace/searchBoxStore'
import { LinkReleaseTriggerAction } from '@/types/searchBoxTypes'
import { FuseFilterWithValue } from '@/utils/fuseUtil'

import NodeSearchBox from './NodeSearchBox.vue'

let triggerEvent: CanvasPointerEvent | null = null
let listenerController: AbortController | null = null
let disconnectOnReset = false

const settingStore = useSettingStore()
const litegraphService = useLitegraphService()

const { visible } = storeToRefs(useSearchBoxStore())
const dismissable = ref(true)
const getNewNodeLocation = (): Point => {
  return triggerEvent
    ? [triggerEvent.canvasX, triggerEvent.canvasY]
    : litegraphService.getCanvasCenter()
}
const nodeFilters = ref<FuseFilterWithValue<ComfyNodeDefImpl, string>[]>([])
const addFilter = (filter: FuseFilterWithValue<ComfyNodeDefImpl, string>) => {
  nodeFilters.value.push(filter)
}
const removeFilter = (
  filter: FuseFilterWithValue<ComfyNodeDefImpl, string>
) => {
  nodeFilters.value = nodeFilters.value.filter(
    (f) => toRaw(f) !== toRaw(filter)
  )
}
const clearFilters = () => {
  nodeFilters.value = []
}
const closeDialog = () => {
  visible.value = false
}
const canvasStore = useCanvasStore()

const addNode = (nodeDef: ComfyNodeDefImpl) => {
  if (!triggerEvent) {
    console.warn('The trigger event was undefined when addNode was called.')
    return
  }

  disconnectOnReset = false
  const node = litegraphService.addNodeOnGraph(nodeDef, {
    pos: getNewNodeLocation()
  })

  canvasStore.getCanvas().linkConnector.connectToNode(node, triggerEvent)

  // Notify changeTracker - new step should be added
  useWorkflowStore().activeWorkflow?.changeTracker?.checkState()
  window.requestAnimationFrame(closeDialog)
}

const newSearchBoxEnabled = computed(
  () => settingStore.get('Comfy.NodeSearchBoxImpl') === 'default'
)
const showSearchBox = (e: CanvasPointerEvent) => {
  if (newSearchBoxEnabled.value) {
    if (e.pointerType === 'touch') {
      setTimeout(() => {
        showNewSearchBox(e)
      }, 128)
    } else {
      showNewSearchBox(e)
    }
  } else {
    canvasStore.getCanvas().showSearchBox(e)
  }
}

const getFirstLink = () =>
  canvasStore.getCanvas().linkConnector.renderLinks.at(0)

const nodeDefStore = useNodeDefStore()
const showNewSearchBox = (e: CanvasPointerEvent) => {
  const firstLink = getFirstLink()
  if (firstLink) {
    const filter =
      firstLink.toType === 'input'
        ? nodeDefStore.nodeSearchService.inputTypeFilter
        : nodeDefStore.nodeSearchService.outputTypeFilter

    const dataType = firstLink.fromSlot.type?.toString() ?? ''
    addFilter({
      filterDef: filter,
      value: dataType
    })
  }

  visible.value = true
  triggerEvent = e

  // Prevent the dialog from being dismissed immediately
  dismissable.value = false
  setTimeout(() => {
    dismissable.value = true
  }, 300)
}

const showContextMenu = (e: CanvasPointerEvent) => {
  const firstLink = getFirstLink()
  if (!firstLink) return

  const { node, fromSlot, toType } = firstLink
  const commonOptions = {
    e,
    allow_searchbox: true,
    showSearchBox: () => {
      cancelResetOnContextClose()
      showSearchBox(e)
    }
  }
  const afterRerouteId = firstLink.fromReroute?.id
  const connectionOptions =
    toType === 'input'
      ? { nodeFrom: node, slotFrom: fromSlot, afterRerouteId }
      : { nodeTo: node, slotTo: fromSlot, afterRerouteId }

  const canvas = canvasStore.getCanvas()
  const menu = canvas.showConnectionMenu({
    ...connectionOptions,
    ...commonOptions
  })

  if (!menu) {
    console.warn('No menu was returned from showConnectionMenu')
    return
  }

  triggerEvent = e
  listenerController = new AbortController()
  const { signal } = listenerController
  const options = { once: true, signal }

  // Connect the node after it is created via context menu
  useEventListener(
    canvas.canvas,
    'connect-new-default-node',
    (createEvent) => {
      if (!(createEvent instanceof CustomEvent))
        throw new Error('Invalid event')

      const node: unknown = createEvent.detail?.node
      if (!(node instanceof LGraphNode)) throw new Error('Invalid node')

      disconnectOnReset = false
      createEvent.preventDefault()
      canvas.linkConnector.connectToNode(node, e)
    },
    options
  )

  // Reset when the context menu is closed
  const cancelResetOnContextClose = useEventListener(
    menu.controller.signal,
    'abort',
    reset,
    options
  )
}

// Disable litegraph's default behavior of release link and search box.
watchEffect(() => {
  const { canvas } = canvasStore
  if (!canvas) return

  LiteGraph.release_link_on_empty_shows_menu = false
  canvas.allow_searchbox = false

  useEventListener(
    canvas.linkConnector.events,
    'dropped-on-canvas',
    handleDroppedOnCanvas
  )
})

const canvasEventHandler = (e: LiteGraphCanvasEvent) => {
  if (e.detail.subType === 'empty-double-click') {
    showSearchBox(e.detail.originalEvent)
  } else if (e.detail.subType === 'group-double-click') {
    const group = e.detail.group
    const [_, y] = group.pos
    const relativeY = e.detail.originalEvent.canvasY - y
    // Show search box if the click is NOT on the title bar
    if (relativeY > group.titleHeight) {
      showSearchBox(e.detail.originalEvent)
    }
  }
}

const linkReleaseAction = computed(() =>
  settingStore.get('Comfy.LinkRelease.Action')
)

const linkReleaseActionShift = computed(() =>
  settingStore.get('Comfy.LinkRelease.ActionShift')
)

// Prevent normal LinkConnector reset (called by CanvasPointer.finally)
const preventDefault = (e: Event) => e.preventDefault()
const cancelNextReset = (e: CustomEvent<CanvasPointerEvent>) => {
  e.preventDefault()

  const canvas = canvasStore.getCanvas()
  canvas.linkConnector.state.snapLinksPos = [e.detail.canvasX, e.detail.canvasY]
  useEventListener(canvas.linkConnector.events, 'reset', preventDefault, {
    once: true
  })
}

const handleDroppedOnCanvas = (e: CustomEvent<CanvasPointerEvent>) => {
  disconnectOnReset = true
  const action = e.detail.shiftKey
    ? linkReleaseActionShift.value
    : linkReleaseAction.value
  switch (action) {
    case LinkReleaseTriggerAction.SEARCH_BOX:
      cancelNextReset(e)
      showSearchBox(e.detail)
      break
    case LinkReleaseTriggerAction.CONTEXT_MENU:
      cancelNextReset(e)
      showContextMenu(e.detail)
      break
    case LinkReleaseTriggerAction.NO_ACTION:
    default:
      break
  }
}

// Resets litegraph state
const reset = () => {
  listenerController?.abort()
  listenerController = null
  triggerEvent = null

  const canvas = canvasStore.getCanvas()
  canvas.linkConnector.events.removeEventListener('reset', preventDefault)
  if (disconnectOnReset) canvas.linkConnector.disconnectLinks()

  canvas.linkConnector.reset()
  canvas.setDirty(true, true)
}

// Reset connecting links when the search box is closed
watch(visible, () => {
  if (!visible.value) reset()
})

useEventListener(document, 'litegraph:canvas', canvasEventHandler)
</script>

<style>
.invisible-dialog-root {
  width: 60%;
  min-width: 24rem;
  max-width: 48rem;
  border: 0 !important;
  background-color: transparent !important;
  margin-top: 25vh;
  margin-left: 400px;
}
@media all and (max-width: 768px) {
  .invisible-dialog-root {
    margin-left: 0;
  }
}

.node-search-box-dialog-mask {
  align-items: flex-start !important;
}
</style>
