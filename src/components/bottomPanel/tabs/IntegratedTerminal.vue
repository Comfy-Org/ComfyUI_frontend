<template>
  <Tabs value="0" class="h-full w-full">
    <TabList>
      <Tab value="0">Logs</Tab>
      <Tab value="1" v-if="isElectron">Terminal</Tab>
    </TabList>
    <TabPanels class="h-full w-full p-0 overflow-hidden">
      <TabPanel value="0" class="h-full w-full">
        <div class="relative h-full w-full bg-black">
          <p v-if="errorMessage" class="p-4 text-center">{{ errorMessage }}</p>
          <ProgressSpinner
            v-else-if="loading"
            class="absolute inset-0 flex justify-center items-center h-full z-10"
          />
          <LogsTerminal
            v-show="!loading"
            @ready="loading = false"
            @error="errorMessage = $event"
          />
        </div>
      </TabPanel>
      <TabPanel value="1" class="h-full w-full" v-if="isElectron">
        <div class="relative h-full w-full bg-black">
          <CommandTerminal />
        </div>
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import Tab from 'primevue/tab'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import { isElectron } from '@/utils/envUtil'
import LogsTerminal from '@/components/terminal/LogsTerminal.vue'
import CommandTerminal from '@/components/terminal/CommandTerminal.vue'

const errorMessage = ref('')
const loading = ref(true)
</script>
