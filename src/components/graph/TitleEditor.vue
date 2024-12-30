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
import { CSSProperties, ref, watch } from 'vue'

import EditableText from '@/components/common/EditableText.vue'
import { app } from '@/scripts/app'
import { useCanvasStore, useTitleEditorStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

const settingStore = useSettingStore()

const showInput = ref(false)
const editedTitle = ref('')
const inputStyle = ref<CSSProperties>({
  position: 'fixed',
  left: '0px',
  top: '0px',
  width: '200px',
  height: '20px',
  fontSize: '12px'
})

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
    previousCanvasDraggable.value = canvasStore.canvas!.allow_dragcanvas
    canvasStore.canvas!.allow_dragcanvas = false

    if (target instanceof LGraphGroup) {
      const group = target
      const [x, y] = group.pos
      const [w, h] = group.size

      const [left, top] = app.canvasPosToClientPos([x, y])
      inputStyle.value.left = `${left}px`
      inputStyle.value.top = `${top}px`

      const width = w * app.canvas.ds.scale
      const height = group.titleHeight * app.canvas.ds.scale
      inputStyle.value.width = `${width}px`
      inputStyle.value.height = `${height}px`

      const fontSize = group.font_size * app.canvas.ds.scale
      inputStyle.value.fontSize = `${fontSize}px`
    } else if (target instanceof LGraphNode) {
      const node = target
      const [x, y] = node.getBounding()
      const canvasWidth = node.width
      const canvasHeight = LiteGraph.NODE_TITLE_HEIGHT

      const [left, top] = app.canvasPosToClientPos([x, y])
      inputStyle.value.left = `${left}px`
      inputStyle.value.top = `${top}px`

      const width = canvasWidth * app.canvas.ds.scale
      const height = canvasHeight * app.canvas.ds.scale
      inputStyle.value.width = `${width}px`
      inputStyle.value.height = `${height}px`
      const fontSize = 12 * app.canvas.ds.scale
      inputStyle.value.fontSize = `${fontSize}px`
    }
  }
)

const canvasEventHandler = (event: LiteGraphCanvasEvent) => {
  if (event.detail.subType === 'group-double-click') {
    if (!settingStore.get('Comfy.Group.DoubleClickTitleToEdit')) {
      return
    }

    const group: LGraphGroup = event.detail.group
    const [x, y] = group.pos

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
    const [x, y] = node.pos

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
