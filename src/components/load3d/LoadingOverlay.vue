<template>
  <Transition name="fade">
    <div
      v-if="modelLoading"
      class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="flex flex-col items-center">
        <div class="spinner" />
        <div class="text-white mt-4 text-lg">
          {{ loadingMessage }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'

import { t } from '@/i18n'

const modelLoading = ref(false)
const loadingMessage = ref('')

const startLoading = async (message?: string) => {
  loadingMessage.value = message || t('load3d.loadingModel')
  modelLoading.value = true

  await nextTick()
}

const endLoading = async () => {
  await new Promise((resolve) => setTimeout(resolve, 100))
  modelLoading.value = false
}

defineExpose({
  startLoading,
  endLoading
})
</script>

<style scoped>
.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
