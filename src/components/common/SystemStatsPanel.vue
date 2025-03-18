<template>
  <div class="system-stats">
    <div class="mb-6">
      <h2 class="text-2xl font-semibold mb-4">{{ $t('g.systemInfo') }}</h2>
      <div class="grid grid-cols-2 gap-2">
        <template v-for="col in systemColumns" :key="col.field">
          <div class="font-medium">{{ col.header }}</div>
          <div>{{ formatValue(systemInfo[col.field], col.field) }}</div>
        </template>
      </div>
    </div>

    <Divider />

    <div>
      <h2 class="text-2xl font-semibold mb-4">{{ $t('g.devices') }}</h2>
      <TabView v-if="props.stats.devices.length > 1">
        <TabPanel
          v-for="device in props.stats.devices"
          :key="device.index"
          :header="device.name"
          :value="device.index"
        >
          <DeviceInfo :device="device" />
        </TabPanel>
      </TabView>
      <DeviceInfo v-else :device="props.stats.devices[0]" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import TabPanel from 'primevue/tabpanel'
import TabView from 'primevue/tabview'
import { computed } from 'vue'

import DeviceInfo from '@/components/common/DeviceInfo.vue'
import type { SystemStats } from '@/schemas/apiSchema'
import { formatSize } from '@/utils/formatUtil'

const props = defineProps<{
  stats: SystemStats
}>()

const systemInfo = computed(() => ({
  ...props.stats.system,
  argv: props.stats.system.argv.join(' ')
}))

const systemColumns: { field: keyof SystemStats['system']; header: string }[] =
  [
    { field: 'os', header: 'OS' },
    { field: 'python_version', header: 'Python Version' },
    { field: 'embedded_python', header: 'Embedded Python' },
    { field: 'pytorch_version', header: 'Pytorch Version' },
    { field: 'argv', header: 'Arguments' },
    { field: 'ram_total', header: 'RAM Total' },
    { field: 'ram_free', header: 'RAM Free' }
  ]

const formatValue = (value: any, field: string) => {
  if (['ram_total', 'ram_free'].includes(field)) {
    return formatSize(value)
  }
  return value
}
</script>
