import { isCloud } from '@/platform/distribution/types'
import type { SystemStats } from '@/schemas/apiSchema'
import { formatCommitHash, formatSize } from '@/utils/formatUtil'

const frontendCommit = __COMFYUI_FRONTEND_COMMIT__

type SystemInfoKey = keyof SystemStats['system']

export type SystemStatsColumn = {
  field: SystemInfoKey
  headerKey: string
  getValue?: () => string
  format?: (value: string) => string
  formatNumber?: (value: number) => string
}

const localColumns: SystemStatsColumn[] = [
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

const cloudColumns: SystemStatsColumn[] = [
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

export function getSystemStatsColumns(): SystemStatsColumn[] {
  return isCloud ? cloudColumns : localColumns
}

export function getColumnDisplayValue(
  stats: SystemStats,
  column: SystemStatsColumn
): string | number | boolean | undefined {
  const systemInfo = {
    ...stats.system,
    argv: stats.system.argv.join(' ')
  }
  const value = column.getValue ? column.getValue() : systemInfo[column.field]
  if (column.formatNumber && typeof value === 'number') {
    return column.formatNumber(value)
  }
  if (column.format && typeof value === 'string') {
    return column.format(value)
  }
  if (Array.isArray(value)) return undefined
  return value
}
