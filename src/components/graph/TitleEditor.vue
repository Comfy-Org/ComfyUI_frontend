<template>
  <div
    v-if="showInput"
    class="group-title-editor node-title-editor"
    :style="inputStyle"
  >
    <EditableText
      :isEditing="showInput"
      :modelValue="editedTitle"
      @edit="onEdit"
    />
  </div>
</template>

<script setup lang="ts">
import { LGraphGroup, LGraphNode, LiteGraph } from '@comfyorg/litegraph'
import type { LiteGraphCanvasEvent } from '@comfyorg/litegraph'
import { useEventListener } from '@vueuse/core'
import { ref, watch } from 'vue'

import EditableText from '@/components/common/EditableText.vue'
import { useAbsolutePosition } from '@/composables/element/useAbsolutePosition'
import { app } from '@/scripts/app'
import { useCanvasStore, useTitleEditorStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

const settingStore = useSettingStore()

const showInput = ref(false)
const editedTitle = ref('')
const { style: inputStyle, updatePosition } = useAbsolutePosition()

const titleEditorStore = useTitleEditorStore()
const canvasStore = useCanvasStore()
const previousCanvasDraggable = ref(true)

const onEdit = (newValue: string) => {
  if (titleEditorStore.titleEditorTarget && newValue.trim() !== '') {
    titleEditorStore.titleEditorTarget.title = newValue.trim()
    app.graph.setDirtyCanvas(true, true)
  }
  showInput.value = false
  titleEditorStore.titleEditorTarget = null
  canvasStore.canvas!.allow_dragcanvas = previousCanvasDraggable.value
}

watch(
  () => titleEditorStore.titleEditorTarget,
  (target) => {
    if (target === null) {
      return
    }
    editedTitle.value = target.title
    showInput.value = true
    const canvas = canvasStore.canvas!
    previousCanvasDraggable.value = canvas.allow_dragcanvas
    canvas.allow_dragcanvas = false
    const scale = canvas.ds.scale

    if (target instanceof LGraphGroup) {
      const group = target
      updatePosition(
        {
          pos: group.pos,
          size: [group.size[0], group.titleHeight]
        },
        { fontSize: `${group.font_size * scale}px` }
      )
    } else if (target instanceof LGraphNode) {
      const node = target
      const [x, y] = node.getBounding()
      updatePosition(
        {
          pos: [x, y],
          size: [node.width, LiteGraph.NODE_TITLE_HEIGHT]
        },
        { fontSize: `${12 * scale}px` }
      )
    }
  }
)

const canvasEventHandler = (event: LiteGraphCanvasEvent) => {
  if (event.detail.subType === 'group-double-click') {
    if (!settingStore.get('Comfy.Group.DoubleClickTitleToEdit')) {
      return
    }

    const group: LGraphGroup = event.detail.group
    const [_, y] = group.pos

    const e = event.detail.originalEvent
    const relativeY = e.canvasY - y
    // Only allow editing if the click is on the title bar
    if (relativeY <= group.titleHeight) {
      titleEditorStore.titleEditorTarget = group
    }
  } else if (event.detail.subType === 'node-double-click') {
    if (!settingStore.get('Comfy.Node.DoubleClickTitleToEdit')) {
      return
    }

    const node: LGraphNode = event.detail.node
    const [_, y] = node.pos

    const e = event.detail.originalEvent
    const relativeY = e.canvasY - y
    // Only allow editing if the click is on the title bar
    if (relativeY <= 0) {
      titleEditorStore.titleEditorTarget = node
    }
  }
}

useEventListener(document, 'litegraph:canvas', canvasEventHandler)
</script>

<style scoped>
.group-title-editor.node-title-editor {
  z-index: 9999;
  padding: 0.25rem;
}

:deep(.editable-text) {
  width: 100%;
  height: 100%;
}

:deep(.editable-text input) {
  width: 100%;
  height: 100%;
  /* Override the default font size */
  font-size: inherit;
}
</style>
