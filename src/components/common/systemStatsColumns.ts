import { isCloud } from '@/platform/distribution/types'
import type { SystemStats } from '@/schemas/apiSchema'
import { formatCommitHash, formatSize } from '@/utils/formatUtil'

const frontendCommit = __COMFYUI_FRONTEND_COMMIT__

type SystemInfoKey = keyof SystemStats['system']

export type SystemStatsColumn = {
  field: SystemInfoKey
  header: string
  getValue?: () => string
  format?: (value: string) => string
  formatNumber?: (value: number) => string
}

const localColumns: SystemStatsColumn[] = [
  { field: 'os', header: 'OS' },
  { field: 'python_version', header: 'Python Version' },
  { field: 'embedded_python', header: 'Embedded Python' },
  { field: 'pytorch_version', header: 'Pytorch Version' },
  { field: 'argv', header: 'Arguments' },
  { field: 'ram_total', header: 'RAM Total', formatNumber: formatSize },
  { field: 'ram_free', header: 'RAM Free', formatNumber: formatSize },
  { field: 'installed_templates_version', header: 'Templates Version' }
]

const cloudColumns: SystemStatsColumn[] = [
  { field: 'cloud_version', header: 'Cloud Version' },
  {
    field: 'comfyui_version',
    header: 'ComfyUI Version',
    format: formatCommitHash
  },
  {
    field: 'comfyui_frontend_version',
    header: 'Frontend Version',
    getValue: () => frontendCommit,
    format: formatCommitHash
  },
  { field: 'workflow_templates_version', header: 'Templates Version' }
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
  return value
}
