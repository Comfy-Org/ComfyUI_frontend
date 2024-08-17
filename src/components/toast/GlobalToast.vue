<template>
  <Toast />
</template>

<script setup lang="ts">
import { useToastStore } from '@/stores/toastStore'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { watch } from 'vue'

const toast = useToast()
const toastStore = useToastStore()

watch(
  () => toastStore.messages,
  (newMessages) => {
    if (newMessages.length === 0) {
      return
    }

    newMessages.forEach((message) => {
      toast.add(message)
    })
    toastStore.removeAll()
  },
  { deep: true }
)
</script>
