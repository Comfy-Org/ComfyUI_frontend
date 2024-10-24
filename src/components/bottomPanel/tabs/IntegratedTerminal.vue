<template>
  <Terminal class="h-full w-full border-none" :welcomeMessage="log" />
</template>

<script setup lang="ts">
import { api } from '@/scripts/api'
import Terminal from 'primevue/terminal'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const log = ref<string>('')

let intervalId: number = 0

onMounted(async () => {
  const fetchLogs = async () => {
    log.value = await api.getLogs()
  }

  fetchLogs()
  intervalId = window.setInterval(fetchLogs, 500)
})

onBeforeUnmount(() => {
  window.clearInterval(intervalId)
})
</script>
