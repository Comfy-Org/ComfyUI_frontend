<template>
  <div
    class="w-full h-full flex flex-col rounded-lg p-6 bg-[#2d2d2d] justify-between"
  >
    <h1 class="dialog-title font-semibold text-xl m-0 italic">{{ title }}</h1>
    <p class="whitespace-pre-wrap">{{ message }}</p>
    <div class="flex w-full gap-2">
      <Button
        v-for="button in buttons"
        :key="button.label"
        class="first:mr-auto"
        :label="button.label"
        :severity="button.severity ?? 'secondary'"
        @click="electronAPI().Dialog.clickButton(button.returnValue ?? '')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { electronAPI } from '@/utils/envUtil'

interface DialogButton {
  label: string
  returnValue: string | null
  severity?: 'primary' | 'secondary' | 'danger' | 'warn'
}

const route = useRoute()

// Get title and message from query parameters
const title = computed(() => {
  const { title } = route.query
  return typeof title === 'string' ? title : ''
})
const message = computed(() => {
  const { message } = route.query
  return typeof message === 'string' ? message : ''
})

const buttons = computed(() => {
  try {
    const buttonsParam = route.query.buttons
    if (!buttonsParam || typeof buttonsParam !== 'string') {
      return []
    }
    const parsed = JSON.parse(buttonsParam)
    if (!Array.isArray(parsed)) {
      console.error('Invalid buttons parameter: expected array')
      return []
    }
    return parsed as DialogButton[]
  } catch (error) {
    console.error('Failed to parse buttons parameter:', error)
    return []
  }
})
</script>

<style scoped>
@reference '../assets/css/style.css';

.dialog-title {
  font-family: 'ABC ROM';
}

.p-button {
  @apply rounded-lg;
}

.p-button-secondary {
  @apply text-white rounded-lg border-none;

  background: var(--color-button-background, rgba(255, 255, 255, 0.15));
}

.p-button-secondary:hover {
  background: rgba(255, 255, 255, 0.25);
}

.p-button-secondary:active {
  background: rgba(255, 255, 255, 0.35);
}

.p-button-danger {
  background: rgba(241, 67, 82, 0.5);
  border: 0;
}

.p-button-danger:hover {
  background: rgba(241, 67, 82, 0.75);
}

.p-button-danger:active {
  background: rgba(241, 67, 82, 0.88);
}

.p-button-warn {
  background: rgba(23, 45, 215, 0.66);
  color: #f0ff41;
  border: 0;
}

.p-button-warn:hover {
  background: rgba(23, 45, 215, 0.88);
  color: #f0ff41;
  border: 0;
}

.p-button-warn:active {
  background: rgba(23, 45, 215, 1);
  color: #f0ff41;
  border: 0;
}
</style>
