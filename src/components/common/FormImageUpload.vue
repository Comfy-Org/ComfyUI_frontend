<template>
  <div class="image-upload-wrapper">
    <div class="flex gap-2 items-center">
      <div
        class="preview-box border rounded p-2 w-16 h-16 flex items-center justify-center"
        :class="{ 'bg-gray-100 dark:bg-gray-800': !modelValue }"
      >
        <img
          v-if="modelValue"
          :src="modelValue"
          class="max-w-full max-h-full object-contain"
        />
        <i v-else class="pi pi-image text-gray-400 text-xl" />
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
