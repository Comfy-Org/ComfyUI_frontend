<template>
  <div v-if="showInput" class="group-title-editor" :style="inputStyle">
    <EditableText
      :isEditing="showInput"
      :modelValue="editedTitle"
      @edit="onEdit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, CSSProperties, watch } from 'vue'
import { app } from '@/scripts/app'
import { LGraphGroup } from '@comfyorg/litegraph'
import EditableText from '@/components/common/EditableText.vue'
import { useSettingStore } from '@/stores/settingStore'
import type { LiteGraphCanvasEvent } from '@comfyorg/litegraph'
import { useTitleEditorStore } from '@/stores/graphStore'

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

const onEdit = (newValue: string) => {
  if (titleEditorStore.titleEditorTarget && newValue.trim() !== '') {
    titleEditorStore.titleEditorTarget.title = newValue.trim()
    app.graph.setDirtyCanvas(true, true)
  }
  showInput.value = false
  titleEditorStore.titleEditorTarget = null
}

watch(titleEditorStore.titleEditorTarget, (target) => {
  if (!(target instanceof LGraphGroup)) {
    return
  }

  const group = target
  const [x, y] = group.pos
  const [w, h] = group.size
  editedTitle.value = group.title
  showInput.value = true

  const [left, top] = app.canvasPosToClientPos([x, y])
  inputStyle.value.left = `${left}px`
  inputStyle.value.top = `${top}px`

  const width = w * app.canvas.ds.scale
  const height = group.titleHeight * app.canvas.ds.scale
  inputStyle.value.width = `${width}px`
  inputStyle.value.height = `${height}px`

  const fontSize = group.font_size * app.canvas.ds.scale
  inputStyle.value.fontSize = `${fontSize}px`
})

const canvasEventHandler = (event: LiteGraphCanvasEvent) => {
  if (!settingStore.get('Comfy.Group.DoubleClickTitleToEdit')) {
    return
  }

  if (event.detail.subType === 'group-double-click') {
    const group: LGraphGroup = event.detail.group
    const [x, y] = group.pos

    const e = event.detail.originalEvent
    // @ts-expect-error LiteGraphCanvasEvent is not typed
    const relativeY = e.canvasY - y
    // Only allow editing if the click is on the title bar
    if (relativeY > group.titleHeight) {
      return
    }

    titleEditorStore.titleEditorTarget = group
  }
}

onMounted(() => {
  document.addEventListener('litegraph:canvas', canvasEventHandler)
})

onUnmounted(() => {
  document.removeEventListener('litegraph:canvas', canvasEventHandler)
})
</script>

<style scoped>
.node-title-editor {
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
