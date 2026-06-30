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
            {{ $t(col.headerKey) }}
          </div>
          <div :class="cn(isOutdated(col) && 'text-danger-100')">
            {{ getDisplayValue(col) }}
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

import DeviceInfo from '@/components/common/DeviceInfo.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { isCloud } from '@/platform/distribution/types'
import type { SystemStats } from '@/schemas/apiSchema'
import { formatCommitHash, formatSize } from '@/utils/formatUtil'
import { cn } from '@comfyorg/tailwind-utils'
import { useI18n } from 'vue-i18n'

const frontendCommit = __COMFYUI_FRONTEND_COMMIT__
const { t } = useI18n()

const props = defineProps<{
  stats: SystemStats
}>()

const { copyToClipboard } = useCopyToClipboard()

const systemInfo = computed(() => ({
  ...props.stats.system,
  argv: props.stats.system.argv.join(' ')
}))

const hasDevices = computed(() => props.stats.devices.length > 0)

type SystemInfoKey = keyof SystemStats['system']

type ColumnDef = {
  field: SystemInfoKey
  headerKey: string
  getValue?: () => string
  format?: (value: string) => string
  formatNumber?: (value: number) => string
}

/** Columns for local distribution */
const localColumns: ColumnDef[] = [
  { field: 'os', headerKey: 'g.systemStatsOS' },
  { field: 'python_version', headerKey: 'g.systemStatsPythonVersion' },
  { field: 'embedded_python', headerKey: 'g.systemStatsEmbeddedPython' },
  { field: 'pytorch_version', headerKey: 'g.systemStatsPyTorchVersion' },
  { field: 'argv', headerKey: 'g.systemStatsArguments' },
  {
    field: 'ram_total',
    headerKey: 'g.systemStatsRAMTotal',
    formatNumber: formatSize
  },
  {
    field: 'ram_free',
    headerKey: 'g.systemStatsRAMFree',
    formatNumber: formatSize
  },
  {
    field: 'installed_templates_version',
    headerKey: 'g.systemStatsTemplatesVersion'
  }
]

/** Columns for cloud distribution */
const cloudColumns: ColumnDef[] = [
  { field: 'cloud_version', headerKey: 'g.systemStatsCloudVersion' },
  {
    field: 'comfyui_version',
    headerKey: 'g.systemStatsComfyUIVersion',
    format: formatCommitHash
  },
  {
    field: 'comfyui_frontend_version',
    headerKey: 'g.systemStatsFrontendVersion',
    getValue: () => frontendCommit,
    format: formatCommitHash
  },
  {
    field: 'workflow_templates_version',
    headerKey: 'g.systemStatsTemplatesVersion'
  }
]

const systemColumns = computed(() => (isCloud ? cloudColumns : localColumns))

function isOutdated(column: ColumnDef): boolean {
  if (column.field !== 'installed_templates_version') return false
  const installed = props.stats.system.installed_templates_version
  const required = props.stats.system.required_templates_version
  return !!installed && !!required && installed !== required
}

function getDisplayValue(column: ColumnDef) {
  const value = column.getValue
    ? column.getValue()
    : systemInfo.value[column.field]
  if (column.formatNumber && typeof value === 'number') {
    return column.formatNumber(value)
  }
  if (column.format && typeof value === 'string') {
    return column.format(value)
  }
  return value
}

function formatSystemInfoText(): string {
  const lines: string[] = ['## System Info']

  for (const col of systemColumns.value) {
    const display = getDisplayValue(col)
    if (display !== undefined && display !== '') {
      lines.push(`${t(col.headerKey)}: ${display}`)
    }
  }

  if (hasDevices.value) {
    lines.push('')
    lines.push('## Devices')
    for (const device of props.stats.devices) {
      lines.push(`- ${device.name} (${device.type})`)
      lines.push(`  VRAM Total: ${formatSize(device.vram_total)}`)
      lines.push(`  VRAM Free: ${formatSize(device.vram_free)}`)
      lines.push(`  Torch VRAM Total: ${formatSize(device.torch_vram_total)}`)
      lines.push(`  Torch VRAM Free: ${formatSize(device.torch_vram_free)}`)
    }
  }

  return lines.join('\n')
}

function copySystemInfo() {
  copyToClipboard(formatSystemInfoText())
}
</script>
