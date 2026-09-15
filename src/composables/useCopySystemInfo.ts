import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import {
  getColumnDisplayValue,
  systemStatsColumns
} from '@/components/common/systemStatsColumns'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { t } from '@/i18n'
import type { SystemStats } from '@/schemas/apiSchema'
import { formatSize } from '@/utils/formatUtil'

function formatSystemInfoText(stats: SystemStats): string {
  const lines: string[] = ['## System Info']

  for (const col of systemStatsColumns) {
    const display = getColumnDisplayValue(stats, col)
    if (display !== undefined && display !== '') {
      lines.push(`${t(col.headerKey)}: ${display}`)
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

  function copySystemInfo() {
    return copyToClipboard(formatSystemInfoText(toValue(stats)))
  }

  return { copySystemInfo }
}
