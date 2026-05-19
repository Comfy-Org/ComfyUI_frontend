<template>
  <div class="system-stats">
    <div class="mb-6">
      <div class="mb-4 flex items-center gap-2">
        <h2 class="text-2xl font-semibold">
          {{ $t('g.systemInfo') }}
        </h2>
        <CopySystemInfoButton :stats="props.stats" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <template v-for="col in systemColumns" :key="col.field">
          <div :class="cn('font-medium', isOutdated(col) && 'text-danger-100')">
            {{ col.header }}
          </div>
          <div :class="cn(isOutdated(col) && 'text-danger-100')">
            {{ getColumnDisplayValue(props.stats, col) }}
          </div>
        </template>
      </div>
    </div>

    <template v-if="hasDevices">
      <Divider />

      <div>
        <h2 class="mb-4 text-2xl font-semibold">
          {{ $t('g.devices') }}
        </h2>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import TabPanel from 'primevue/tabpanel'
import TabView from 'primevue/tabview'
import { computed } from 'vue'

import CopySystemInfoButton from '@/components/common/CopySystemInfoButton.vue'
import DeviceInfo from '@/components/common/DeviceInfo.vue'
import type { SystemStatsColumn } from '@/components/common/systemStatsColumns'
import {
  getColumnDisplayValue,
  getSystemStatsColumns
} from '@/components/common/systemStatsColumns'
import type { SystemStats } from '@/schemas/apiSchema'
import { cn } from '@comfyorg/tailwind-utils'

const props = defineProps<{
  stats: SystemStats
}>()

const systemColumns = getSystemStatsColumns()

const hasDevices = computed(() => props.stats.devices.length > 0)

function isOutdated(column: SystemStatsColumn): boolean {
  if (column.field !== 'installed_templates_version') return false
  const installed = props.stats.system.installed_templates_version
  const required = props.stats.system.required_templates_version
  return !!installed && !!required && installed !== required
}
</script>
