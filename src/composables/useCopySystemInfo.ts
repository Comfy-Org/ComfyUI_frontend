import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import {
  getColumnDisplayValue,
  getSystemStatsColumns
} from '@/components/common/systemStatsColumns'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import type { SystemStats } from '@/schemas/apiSchema'
import { formatSize } from '@/utils/formatUtil'

function formatSystemInfoText(stats: SystemStats): string {
  const lines: string[] = ['## System Info']

  for (const col of getSystemStatsColumns()) {
    const display = getColumnDisplayValue(stats, col)
    if (display !== undefined && display !== '') {
      lines.push(`${col.header}: ${display}`)
    }
  }

  if (stats.devices.length > 0) {
    lines.push('')
    lines.push('## Devices')
    for (const device of stats.devices) {
      lines.push(`- ${device.name} (${device.type})`)
      lines.push(`  VRAM Total: ${formatSize(device.vram_total)}`)
      lines.push(`  VRAM Free: ${formatSize(device.vram_free)}`)
      lines.push(`  Torch VRAM Total: ${formatSize(device.torch_vram_total)}`)
      lines.push(`  Torch VRAM Free: ${formatSize(device.torch_vram_free)}`)
    }
  }

  return lines.join('\n')
}

export function useCopySystemInfo(stats: MaybeRefOrGetter<SystemStats>) {
  const { copyToClipboard } = useCopyToClipboard()
  const formattedText = computed(() => formatSystemInfoText(toValue(stats)))

  function copySystemInfo() {
    return copyToClipboard(formattedText.value)
  }

  return { copySystemInfo }
}
