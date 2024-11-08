<template>
  <Tabs value="0" class="h-full w-full">
    <TabList>
      <Tab value="0">Logs</Tab>
      <Tab value="1">Terminal</Tab>
    </TabList>
    <TabPanels class="h-full w-full p-0 overflow-hidden">
      <TabPanel value="0" class="h-full w-full">
        <div class="relative h-full w-full bg-black">
          <p v-if="errorMessage" class="p-4 text-center">{{ errorMessage }}</p>
          <ProgressSpinner
            v-else-if="loading"
            class="absolute inset-0 flex justify-center items-center h-full z-10"
          />
          <Terminal v-show="!loading" ref="logsTerminal" />
        </div>
      </TabPanel>
      <TabPanel value="1" class="h-full w-full">
        <div class="relative h-full w-full bg-black">
          <Terminal
            ref="commandTerminal"
            allow-input
            auto-width
            @execute="executeCommand"
          />
        </div>
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>

<script setup lang="ts">
import { api } from '@/scripts/api'
import { onMounted, onUnmounted, ref } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import { useExecutionStore } from '@/stores/executionStore'
import { storeToRefs } from 'pinia'
import { until } from '@vueuse/core'
import { LogEntry, LogsWsMessage, TerminalSize } from '@/types/apiTypes'
import Terminal from '@/components/terminal/Terminal.vue'
import Tab from 'primevue/tab'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'

type TerminalComponent = {
  update: (entries: Array<string>, size?: TerminalSize) => void
}

const errorMessage = ref('')
const loading = ref(true)
const logsTerminal = ref<TerminalComponent>()
const commandTerminal = ref<TerminalComponent>()
const electronBridge: any = null

const update = (entries: Array<LogEntry>, size?: TerminalSize) => {
  logsTerminal.value.update(
    entries.map((data) => data.m),
    size
  )
}

const logReceived = (e: CustomEvent<LogsWsMessage>) => {
  update(e.detail.entries, e.detail.size)
}

const loadLogEntries = async () => {
  const logs = await api.getRawLogs()
  update(logs.entries, logs.size)
}

const watchLogs = async () => {
  const { clientId } = storeToRefs(useExecutionStore())
  if (!clientId.value) {
    await until(clientId).not.toBeNull()
  }
  api.subscribeLogs(true)
  api.addEventListener('logs', logReceived)
}

const executeCommand = (message: string) => {
  if (electronBridge) {
    // TODO:
  } else {
    commandTerminal.value.update([
      `\x1b[1;31mExecuting native commands isn't supported in this environment, to view a list of available commands type !\x1b[m\n`
    ])
  }
}

onMounted(async () => {
  try {
    await loadLogEntries()
  } catch (err) {
    console.error('Error loading logs', err)
    // On older backends the endpoints wont exist
    errorMessage.value =
      'Unable to load logs, please ensure you have updated your ComfyUI backend.'
    return
  }

  loading.value = false
  await watchLogs()
})

onUnmounted(() => {
  if (api.clientId) {
    api.subscribeLogs(false)
  }
  api.removeEventListener('logs', logReceived)
})
</script>

<style scoped>
:deep(.p-autocomplete-input) {
  width: 100%;
}
</style>
