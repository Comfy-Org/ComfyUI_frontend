import { isCloud } from '@/platform/distribution/types'
import type { SystemStats } from '@/schemas/apiSchema'
import { formatCommitHash, formatSize } from '@comfyorg/shared-frontend-utils/formatUtil'

const frontendCommit = __COMFYUI_FRONTEND_COMMIT__

type SystemInfoKey = keyof SystemStats['system']

export type SystemStatsColumn = Readonly<{
  field: SystemInfoKey
  headerKey: string
  format?: (value: string) => string
  formatNumber?: (value: number) => string
  getValue?: () => string
}>

const localColumns = [
  { field: 'argv', headerKey: 'g.systemStatsArguments' },
  { field: 'embedded_python', headerKey: 'g.systemStatsEmbeddedPython' },
  {
    field: 'installed_templates_version',
    headerKey: 'g.systemStatsTemplatesVersion'
  },
  { field: 'os', headerKey: 'g.systemStatsOS' },
  { field: 'python_version', headerKey: 'g.systemStatsPythonVersion' },
  { field: 'pytorch_version', headerKey: 'g.systemStatsPyTorchVersion' },
  {
    field: 'ram_free',
    headerKey: 'g.systemStatsRAMFree',
    formatNumber: formatSize
  },
  {
    field: 'ram_total',
    headerKey: 'g.systemStatsRAMTotal',
    formatNumber: formatSize
  }
] as const satisfies readonly SystemStatsColumn[]

const cloudColumns = [
  { field: 'cloud_version', headerKey: 'g.systemStatsCloudVersion' },
  {
    field: 'comfyui_frontend_version',
    headerKey: 'g.systemStatsFrontendVersion',
    getValue: () => frontendCommit,
    format: formatCommitHash
  },
  {
    field: 'comfyui_version',
    headerKey: 'g.systemStatsComfyUIVersion',
    format: formatCommitHash
  },
  {
    field: 'workflow_templates_version',
    headerKey: 'g.systemStatsTemplatesVersion'
  }
] as const satisfies readonly SystemStatsColumn[]

export const systemStatsColumns: readonly SystemStatsColumn[] = isCloud
  ? cloudColumns
  : localColumns

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
