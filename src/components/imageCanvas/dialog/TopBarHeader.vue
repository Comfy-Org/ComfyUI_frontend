<template>
  <div class="flex w-full items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <h3 class="m-0 text-lg font-semibold">{{ t('imageCanvas.title') }}</h3>

      <div class="flex items-center gap-4">
        <button
          :class="iconButtonClass"
          :title="t('imageCanvas.undo')"
          @click="onUndo"
        >
          <svg
            viewBox="0 0 15 15"
            class="h-6.25 w-6.25 pointer-events-none fill-[var(--input-text)]"
          >
            <path
              d="M8.77,12.18c-.25,0-.46-.2-.46-.46s.2-.46.46-.46c1.47,0,2.67-1.2,2.67-2.67,0-1.57-1.34-2.67-3.26-2.67h-3.98l1.43,1.43c.18.18.18.47,0,.64-.18.18-.47.18-.64,0l-2.21-2.21c-.18-.18-.18-.47,0-.64l2.21-2.21c.18-.18.47-.18.64,0,.18.18.18.47,0,.64l-1.43,1.43h3.98c2.45,0,4.17,1.47,4.17,3.58,0,1.97-1.61,3.58-3.58,3.58Z"
            />
          </svg>
        </button>

        <button
          :class="iconButtonClass"
          :title="t('imageCanvas.redo')"
          @click="onRedo"
        >
          <svg
            viewBox="0 0 15 15"
            class="h-6.25 w-6.25 pointer-events-none fill-[var(--input-text)]"
          >
            <path
              class="cls-1"
              d="M6.23,12.18c-1.97,0-3.58-1.61-3.58-3.58,0-2.11,1.71-3.58,4.17-3.58h3.98l-1.43-1.43c-.18-.18-.18-.47,0-.64.18-.18.46-.18.64,0l2.21,2.21c.09.09.13.2.13.32s-.05.24-.13.32l-2.21,2.21c-.18.18-.47.18-.64,0-.18-.18-.18-.47,0-.64l1.43-1.43h-3.98c-1.92,0-3.26,1.1-3.26,2.67,0,1.47,1.2,2.67,2.67,2.67.25,0,.46.2.46.46s-.2.46-.46.46Z"
            />
          </svg>
        </button>

        <button :class="textButtonClass" @click="onInvert">
          {{ t('imageCanvas.invert') }}
        </button>

        <button :class="textButtonClass" @click="onClear">
          {{ t('imageCanvas.clear') }}
        </button>
      </div>
    </div>

    <div class="flex gap-3">
      <Button variant="primary" :disabled="!saveEnabled" @click="handleSave">
        <i class="pi pi-check" />
        {{ saveButtonText }}
      </Button>
      <Button variant="secondary" @click="handleCancel">
        <i class="pi pi-times" />
        {{ t('g.cancel') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useCanvasTools } from '@/composables/imageCanvas/useCanvasTools'
import { useimageCanvasSaver } from '@/composables/imageCanvas/useimageCanvasSaver'
import { t } from '@/i18n'
import { useDialogStore } from '@/stores/dialogStore'
import { useimageCanvasStore } from '@/stores/imageCanvasStore'

const store = useimageCanvasStore()
const dialogStore = useDialogStore()
const canvasTools = useCanvasTools()
const saver = useimageCanvasSaver()

const saveButtonText = ref(t('g.save'))
const saveEnabled = ref(true)

const iconButtonClass =
  'flex h-7.5 w-12.5 items-center justify-center rounded-[10px] border border-[var(--p-form-field-border-color)] pointer-events-auto transition-colors duration-100 bg-[var(--comfy-menu-bg)] hover:bg-secondary-background-hover'

const textButtonClass =
  'h-7.5 w-15 rounded-[10px] border border-[var(--p-form-field-border-color)] text-[var(--input-text)] font-sans pointer-events-auto transition-colors duration-100 bg-[var(--comfy-menu-bg)] hover:bg-secondary-background-hover'

const onUndo = () => {
  store.canvasHistory.undo()
}

const onRedo = () => {
  store.canvasHistory.redo()
}

const onInvert = () => {
  canvasTools.invertMask()
}

const onClear = () => {
  canvasTools.clearMask()
  store.triggerClear()
}

const handleSave = async () => {
  saveButtonText.value = t('g.saving')
  saveEnabled.value = false

  try {
    store.brushVisible = false
    await saver.save()
    dialogStore.closeDialog()
  } catch (error) {
    console.error('[TopBarHeader] Save failed:', error)
    store.brushVisible = true
    saveButtonText.value = t('g.save')
    saveEnabled.value = true
  }
}

const handleCancel = () => {
  dialogStore.closeDialog({ key: 'global-image-canvas' })
}
</script>
