<template>
  <div class="system-stats">
    <div class="mb-6">
      <div class="mb-4 flex items-center gap-2">
        <h2 class="text-2xl font-semibold">
          {{ $t('g.systemInfo') }}
        </h2>
        <Button variant="secondary" @click="copySystemInfo">
          <i class="pi pi-copy" />
          {{ $t('g.copySystemInfo') }}
        </Button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <template v-for="col in systemColumns" :key="col.field">
          <div :class="cn('font-medium', isOutdated(col) && 'text-danger-100')">
            {{ col.header }}
          </div>
          <div :class="cn(isOutdated(col) && 'text-danger-100')">
            {{ getColumnDisplayValue(stats, col) }}
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
        <TabView v-if="stats.devices.length > 1">
          <TabPanel
            v-for="device in stats.devices"
            :key="device.index"
            :header="device.name"
            :value="device.index"
          >
            <DeviceInfo :device="device" />
          </TabPanel>
        </TabView>
        <DeviceInfo v-else :device="stats.devices[0]" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import TabPanel from 'primevue/tabpanel'
import TabView from 'primevue/tabview'
import { computed } from 'vue'

import DeviceInfo from '@/components/common/DeviceInfo.vue'
import type { SystemStatsColumn } from '@/components/common/systemStatsColumns'
import {
  getColumnDisplayValue,
  getSystemStatsColumns
} from '@/components/common/systemStatsColumns'
import Button from '@/components/ui/button/Button.vue'
import { useCopySystemInfo } from '@/composables/useCopySystemInfo'
import type { SystemStats } from '@/schemas/apiSchema'
import { cn } from '@comfyorg/tailwind-utils'

const { stats } = defineProps<{
  stats: SystemStats
}>()

const systemColumns = getSystemStatsColumns()

const hasDevices = computed(() => stats.devices.length > 0)

const { copySystemInfo } = useCopySystemInfo(() => stats)

function isOutdated(column: SystemStatsColumn): boolean {
  if (column.field !== 'installed_templates_version') return false
  const installed = stats.system.installed_templates_version
  const required = stats.system.required_templates_version
  return !!installed && !!required && installed !== required
}
</script>
