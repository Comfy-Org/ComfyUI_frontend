import path from 'node:path'

/** Folder name for one acceptance run from its local start time, as `YYYY-MM-DD_HHMMSS`. */
export function runFolderName(start: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const day = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
  const time = `${pad(start.getHours())}${pad(start.getMinutes())}${pad(start.getSeconds())}`
  return `${day}_${time}`
}

/** Folder holding every acceptance run and their index. */
export const REPORT_ROOT = 'nodes2-acceptance-report'

/** Directory a run's report, data and layout survey are written to: its own folder under {@link REPORT_ROOT}. */
export const REPORT_DIR =
  process.env.NODES2_ACCEPTANCE_REPORT_DIR ??
  path.join(
    REPORT_ROOT,
    process.env.NODES2_ACCEPTANCE_RUN ?? runFolderName(new Date())
  )
