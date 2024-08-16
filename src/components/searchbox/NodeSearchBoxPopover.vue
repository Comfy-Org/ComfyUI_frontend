<template>
  <div>
    <Dialog
      v-model:visible="visible"
      modal
      :dismissable-mask="dismissable"
      @hide="clearFilters"
      :pt="{
        root: { class: 'invisible-dialog-root' },
        mask: { class: 'node-search-box-dialog-mask' },
        transition: {
          enterFromClass: 'opacity-0 scale-75',
          // 100ms is the duration of the transition in the dialog component
          enterActiveClass: 'transition-all duration-100 ease-out',
          leaveActiveClass: 'transition-all duration-100 ease-in',
          leaveToClass: 'opacity-0 scale-75'
        }
      }"
    >
      <template #container>
        <NodeSearchBox
          :filters="nodeFilters"
          :includeReroute="includeReroute"
          @add-filter="addFilter"
          @remove-filter="removeFilter"
          @add-node="addNode"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { app } from '@/scripts/app'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import NodeSearchBox from './NodeSearchBox.vue'
import Dialog from 'primevue/dialog'
import { LiteGraphCanvasEvent, ConnectingLink } from '@comfyorg/litegraph'
import { FilterAndValue } from '@/services/nodeSearchService'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import { ConnectingLinkImpl } from '@/types/litegraphTypes'
import { useSettingStore } from '@/stores/settingStore'
import { LinkReleaseTriggerMode } from '@/types/searchBoxTypes'

const settingStore = useSettingStore()

interface LiteGraphPointerEvent extends Event {
  canvasX: number
  canvasY: number
}

const visible = ref(false)
const dismissable = ref(true)
const triggerEvent = ref<LiteGraphCanvasEvent | null>(null)
const getNewNodeLocation = (): [number, number] => {
  if (triggerEvent.value === null) {
    return [100, 100]
  }

  const originalEvent = triggerEvent.value.detail
    .originalEvent as LiteGraphPointerEvent
  return [originalEvent.canvasX, originalEvent.canvasY]
}
const nodeFilters = reactive([])
const includeReroute = ref(false)
const addFilter = (filter: FilterAndValue) => {
  nodeFilters.push(filter)
}
const removeFilter = (filter: FilterAndValue) => {
  const index = nodeFilters.findIndex((f) => f === filter)
  if (index !== -1) {
    nodeFilters.splice(index, 1)
  }
}
const clearFilters = () => {
  nodeFilters.splice(0, nodeFilters.length)
}
const closeDialog = () => {
  visible.value = false
}

const addNode = (nodeDef: ComfyNodeDefImpl) => {
  const node = app.addNodeOnGraph(nodeDef, { pos: getNewNodeLocation() })

  const eventDetail = triggerEvent.value.detail
  if (eventDetail.subType === 'empty-release') {
    eventDetail.linkReleaseContext.links.forEach((link: ConnectingLink) => {
      ConnectingLinkImpl.createFromPlainObject(link).connectTo(node)
    })
  }

  // TODO: This is not robust timing-wise.
  // PrimeVue complains about the dialog being closed before the event selecting
  // item is fully processed.
  window.setTimeout(() => {
    closeDialog()
  }, 100)
}

const linkReleaseTriggerMode = computed(() => {
  return settingStore.get('Comfy.NodeSearchBoxImpl.LinkReleaseTrigger')
})

const canvasEventHandler = (e: LiteGraphCanvasEvent) => {
  includeReroute.value = false
  const shiftPressed = (e.detail.originalEvent as KeyboardEvent).shiftKey

  if (e.detail.subType === 'empty-release') {
    if (
      (linkReleaseTriggerMode.value === LinkReleaseTriggerMode.HOLD_SHIFT &&
        !shiftPressed) ||
      (linkReleaseTriggerMode.value === LinkReleaseTriggerMode.NOT_HOLD_SHIFT &&
        shiftPressed)
    ) {
      return
    }

    const context = e.detail.linkReleaseContext
    if (context.links.length === 0) {
      console.warn('Empty release with no links! This should never happen')
      return
    }
    const firstLink = ConnectingLinkImpl.createFromPlainObject(context.links[0])
    const filter = useNodeDefStore().nodeSearchService.getFilterById(
      firstLink.releaseSlotType
    )
    const dataType = firstLink.type
    addFilter([filter, dataType])
    includeReroute.value = true
  }
  triggerEvent.value = e
  visible.value = true
  // Prevent the dialog from being dismissed immediately
  dismissable.value = false
  setTimeout(() => {
    dismissable.value = true
  }, 300)
}

const handleEscapeKeyPress = (event) => {
  if (event.key === 'Escape') {
    closeDialog()
  }
}

onMounted(() => {
  document.addEventListener('litegraph:canvas', canvasEventHandler)
  document.addEventListener('keydown', handleEscapeKeyPress)
})

onUnmounted(() => {
  document.removeEventListener('litegraph:canvas', canvasEventHandler)
  document.removeEventListener('keydown', handleEscapeKeyPress)
})
</script>

<style>
.invisible-dialog-root {
  width: 30%;
  min-width: 24rem;
  max-width: 48rem;
  border: 0 !important;
  background-color: transparent !important;
  margin-top: 25vh;
}

.node-search-box-dialog-mask {
  align-items: flex-start !important;
}
</style>
