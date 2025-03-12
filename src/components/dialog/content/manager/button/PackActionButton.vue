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
      <template v-if="isExecuted && !managerStore.allTasksDone">
        {{ managerStore.statusMessage }}
      </template>
      <template v-else>
        {{ label }}
      </template>
    </span>
  </Button>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
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
const toast = useToast()
const isExecuted = ref(false)

const onTasksDone = async (): Promise<void> => {
  toast.add({
    severity: 'success',
    summary: 'Success',
    detail: 'Action completed successfully'
  })
}

const handleClick = (): void => {
  isExecuted.value = true
  emit('action')
  // whenever(() => managerStore.allTasksDone, onTasksDone, {
  //   flush: 'post'
  // })
}
</script>
