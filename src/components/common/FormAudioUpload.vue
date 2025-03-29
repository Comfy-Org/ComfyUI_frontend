<template>
  <FormFileUpload
    :modelValue="modelValue"
    @update:modelValue="emit('update:modelValue', $event)"
    inputAccept="audio/*"
  >
    <template #preview>
      <div
        class="preview-box border rounded p-2 w-16 h-16 flex items-center justify-center"
        :class="{ 'bg-gray-100 dark:bg-gray-800': !modelValue }"
      >
        <audio
          v-if="modelValue"
          :src="modelValue"
          class="max-w-full max-h-full object-contain"
          controls
        />
        <i v-else class="pi pi-volume-up text-gray-400 text-xl"></i>
      </div>
    </template>
  </FormFileUpload>
</template>

<script setup lang="ts">
import FormFileUpload from './FormFileUpload.vue'

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>
