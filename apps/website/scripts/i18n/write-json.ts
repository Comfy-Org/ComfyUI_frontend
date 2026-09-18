import fs from 'node:fs'
import path from 'node:path'

/** Keys are written in sorted order so a diff shows content changes, not churn. */
export function writeSortedJson(
  file: string,
  value: Record<string, string>
): void {
  const sorted: Record<string, string> = {}
  for (const key of Object.keys(value).sort()) sorted[key] = value[key]
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
}
