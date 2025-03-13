<template>
  <Button
    outlined
    class="m-0 p-0 rounded-lg border-neutral-700"
    :severity="severity"
    :class="{
      'w-full': fullWidth,
      'w-min-content': !fullWidth
    }"
    :disabled="isExecuted"
    @click="handleClick"
  >
    <span class="py-2.5 px-3">
      <template v-if="isExecuted">
        {{ managerStore.statusMessage }}
      </template>
      <template v-else>
        {{ label }}
      </template>
    </span>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'

import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { VueSeverity } from '@/types/primeVueTypes'

const {
  fullWidth = false,
  label,
  severity = 'secondary' as VueSeverity
} = defineProps<{
  fullWidth?: boolean
  label: string
  severity?: VueSeverity
}>()

const emit = defineEmits<{
  action: []
}>()

const managerStore = useComfyManagerStore()
const isExecuted = ref(false)

const handleClick = (): void => {
  isExecuted.value = true
  emit('action')
}
</script>
