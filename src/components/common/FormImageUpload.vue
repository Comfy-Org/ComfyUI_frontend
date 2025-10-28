<template>
  <div class="image-upload-wrapper">
    <div class="flex items-center gap-2">
      <div
        class="preview-box flex h-16 w-16 items-center justify-center rounded border p-2"
        :class="{ 'bg-smoke-100 dark-theme:bg-smoke-800': !modelValue }"
      >
        <img
          v-if="modelValue"
          :src="modelValue"
          class="max-h-full max-w-full object-contain"
        />
        <i v-else class="pi pi-image text-xl text-smoke-400" />
      </div>

      <div class="flex flex-col gap-2">
        <Button
          icon="pi pi-upload"
          :label="$t('g.upload')"
          size="small"
          @click="triggerFileInput"
        />
        <Button
          v-if="modelValue"
          class="w-full"
          outlined
          icon="pi pi-trash"
          severity="danger"
          size="small"
          @click="clearImage"
        />
      </div>
    </div>
    <input
      ref="fileInput"
      type="file"
      class="hidden"
      accept="image/*"
      @change="handleFileUpload"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      emit('update:modelValue', e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }
}

const clearImage = () => {
  emit('update:modelValue', '')
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}
</script>
