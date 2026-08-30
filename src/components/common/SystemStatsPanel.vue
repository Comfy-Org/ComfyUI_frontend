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
        <template v-for="col in systemStatsColumns" :key="col.field">
          <div :class="cn('font-medium', isOutdated(col) && 'text-danger-100')">
            {{ $t(col.headerKey) }}
          </div>
          <div :class="cn(isOutdated(col) && 'text-danger-100')">
            {{ getColumnDisplayValue(stats, col) }}
          </div>
        </template>
      </div>
    </div>

    <template v-if="hasDevices">
      <div class="border-t border-interface-stroke" />

      <div>
        <h2 class="mb-4 text-2xl font-semibold">
          {{ $t('g.devices') }}
        </h2>
        <Tabs
          v-if="stats.devices.length > 1"
          :default-value="String(stats.devices[0].index)"
        >
          <TabsList class="mb-4 gap-1 border-b border-interface-stroke">
            <TabsTrigger
              v-for="device in stats.devices"
              :key="device.index"
              :value="String(device.index)"
            >
              {{ device.name }}
            </TabsTrigger>
          </TabsList>
          <TabsContent
            v-for="device in stats.devices"
            :key="device.index"
            :value="String(device.index)"
          >
            <DeviceInfo :device="device" />
          </TabsContent>
        </Tabs>
        <DeviceInfo v-else :device="stats.devices[0]" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import DeviceInfo from '@/components/common/DeviceInfo.vue'
import type { SystemStatsColumn } from '@/components/common/systemStatsColumns'
import {
  getColumnDisplayValue,
  systemStatsColumns
} from '@/components/common/systemStatsColumns'
import Button from '@/components/ui/button/Button.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCopySystemInfo } from '@/composables/useCopySystemInfo'
import type { SystemStats } from '@/schemas/apiSchema'
import { cn } from '@comfyorg/tailwind-utils'

const { stats } = defineProps<{
  stats: SystemStats
}>()

const hasDevices = computed(() => stats.devices.length > 0)

const { copySystemInfo } = useCopySystemInfo(() => stats)

function isOutdated(column: SystemStatsColumn): boolean {
  if (column.field !== 'installed_templates_version') return false
  const installed = stats.system.installed_templates_version
  const required = stats.system.required_templates_version
  return !!installed && !!required && installed !== required
}
</script>
