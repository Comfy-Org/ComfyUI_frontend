<template>
  <div class="system-stats">
    <div class="mb-6">
      <h2 class="text-2xl font-semibold mb-2">{{ $t('systemInfo') }}</h2>
      <div class="grid grid-cols-2 gap-2">
        <template v-for="col in systemColumns" :key="col.field">
          <div class="font-medium">{{ $t(col.header) }}:</div>
          <div>{{ systemInfo[col.field] }}</div>
        </template>
      </div>
    </div>

    <Divider />

    <div>
      <h2 class="text-2xl font-semibold mb-2">{{ $t('devices') }}</h2>
      <TabView v-if="props.stats.devices.length > 1">
        <TabPanel
          v-for="device in props.stats.devices"
          :key="device.index"
          :header="device.name"
        >
          <DeviceInfo :device="device" />
        </TabPanel>
      </TabView>
      <DeviceInfo v-else :device="props.stats.devices[0]" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Divider from 'primevue/divider'
import type { SystemStats } from '@/types/apiTypes'
import DeviceInfo from '@/components/common/DeviceInfo.vue'

const props = defineProps<{
  stats: SystemStats
}>()

const systemInfo = computed(() => ({
  ...props.stats.system,
  argv: props.stats.system.argv.join(' ')
}))

const systemColumns = [
  { field: 'os', header: 'os' },
  { field: 'python_version', header: 'pythonVersion' },
  { field: 'embedded_python', header: 'embeddedPython' },
  { field: 'comfyui_version', header: 'comfyuiVersion' },
  { field: 'pytorch_version', header: 'pytorchVersion' },
  { field: 'argv', header: 'arguments' }
]
</script>
