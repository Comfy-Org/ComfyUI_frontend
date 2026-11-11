<template>
  <EditorCanvas
    v-if="loaded && dataStore.inputData"
    :base-image="dataStore.inputData.baseLayer.image"
    :mask-image="dataStore.inputData.maskLayer.image"
    :paint-image="dataStore.inputData.paintLayer?.image"
    :brush-adjustment="brushAdjustment"
    :extension-tools
    :overlay-points="extensionPoints"
    @error="handleError"
  >
    <template #extension-tools>
      <ExtensionToolButtons :extension-tools />
    </template>
    <template v-if="activeExtension" #extension-settings>
      <ExtensionToolPanel :runtime="activeExtension.runtime" />
    </template>
  </EditorCanvas>
  <LoadingOverlay v-else loading size="sm" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import LoadingOverlay from '@comfyorg/design-system/common/LoadingOverlay'
import EditorCanvas from '@comfyorg/mask-editor/ui/EditorCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useBrushPersistence } from '@/renderer/extensions/maskEditor/composables/useBrushPersistence'
import { useMaskEditorLoader } from '@/renderer/extensions/maskEditor/composables/useMaskEditorLoader'
import { useMaskEditorDataStore } from '@/renderer/extensions/maskEditor/stores/maskEditorDataStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useMaskEditorExtensionTools } from '@/renderer/extensions/maskEditor/composables/useMaskEditorExtensionTools'
import ExtensionToolButtons from './ExtensionToolButtons.vue'
import ExtensionToolPanel from './ExtensionToolPanel.vue'

const { node } = defineProps<{ node: LGraphNode }>()
const dataStore = useMaskEditorDataStore()
const dialogStore = useDialogStore()
const loader = useMaskEditorLoader()
const settings = useSettingStore()
const brushPersistence = useBrushPersistence()
const loadController = new AbortController()
const loaded = ref(false)
const extensionTools = useMaskEditorExtensionTools()
const { points: extensionPoints, active: activeExtension } = extensionTools
const brushAdjustment = {
  useDominantAxis: settings.get('Comfy.MaskEditor.UseDominantAxis'),
  brushAdjustmentSpeed: settings.get('Comfy.MaskEditor.BrushAdjustmentSpeed')
}

brushPersistence.loadAndApply()

function handleError(error: unknown) {
  console.error('[MaskEditorContent] Initialization failed:', error)
  dialogStore.closeDialog()
}

onMounted(() => {
  void loader.loadFromNode(node, loadController.signal).then(() => {
    if (!loadController.signal.aborted) loaded.value = true
  }, handleError)
})

onBeforeUnmount(() => {
  loadController.abort()
  extensionTools.deactivate()
  brushPersistence.save()
  dataStore.reset()
})
</script>
