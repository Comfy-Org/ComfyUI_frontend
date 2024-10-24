<template>
  <div class="p-terminal rounded-none h-full w-full">
    <ScrollPanel class="h-full w-full">
      <pre class="px-4 whitespace-pre-wrap">{{ log }}</pre>
    </ScrollPanel>
  </div>
</template>

<script setup lang="ts">
import ScrollPanel from 'primevue/scrollpanel'
import { api } from '@/scripts/api'
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
