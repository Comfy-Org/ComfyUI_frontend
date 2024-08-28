<template>
  <div v-if="showInput" class="node-title-editor" :style="inputStyle">
    <EditableText
      :isEditing="showInput"
      :modelValue="editedTitle"
      @edit="onEdit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, CSSProperties } from 'vue'
import { app } from '@/scripts/app'
import { LGraphNode } from '@comfyorg/litegraph'
import { ComfyExtension } from '@/types/comfy'
import EditableText from '@/components/common/EditableText.vue'
import { LiteGraph } from '@comfyorg/litegraph'
import { useSettingStore } from '@/stores/settingStore'

const settingStore = useSettingStore()

const showInput = ref(false)
const editedTitle = ref('')
const inputStyle = ref<CSSProperties>({
  position: 'fixed',
  left: '0px',
  top: '0px',
  width: '200px',
  height: '20px'
})

const currentNode = ref<LGraphNode | null>(null)

const onEdit = (newValue: string) => {
  if (currentNode.value && newValue.trim() !== '') {
    currentNode.value.title = newValue.trim()
    app.graph.setDirtyCanvas(true, true)
  }
  showInput.value = false
}

const extension: ComfyExtension = {
  name: 'Comfy.NodeTitleEditor',
  nodeCreated(node: LGraphNode) {
    // Store the original callback
    const originalCallback = node.onNodeTitleDblClick

    node.onNodeTitleDblClick = function (e: MouseEvent, ...args: any[]) {
      if (!settingStore.get('Comfy.Node.DoubleClickTitleToEdit')) {
        return
      }

      currentNode.value = this
      editedTitle.value = this.title
      showInput.value = true

      const isCollapsed = node.flags?.collapsed
      const [x1, y1, x2, y2] = this.getBounding()
      const [nodeWidth, nodeHeight] = this.size
      const canvasWidth =
        // @ts-expect-error Remove after collapsed_width is exposed in LiteGraph
        isCollapsed && node._collapsed_width ? node._collapsed_width : nodeWidth
      const canvasHeight = LiteGraph.NODE_TITLE_HEIGHT

      const [left, top] = app.canvasPosToClientPos([x1, y1])
      inputStyle.value.left = `${left}px`
      inputStyle.value.top = `${top}px`

      const width = canvasWidth * app.canvas.ds.scale
      const height = canvasHeight * app.canvas.ds.scale
      inputStyle.value.width = `${width}px`
      inputStyle.value.height = `${height}px`

      // Call the original callback if it exists
      if (typeof originalCallback === 'function') {
        originalCallback.call(this, e, ...args)
      }
    }
  }
}

onMounted(() => {
  app.registerExtension(extension)
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
}
</style>
