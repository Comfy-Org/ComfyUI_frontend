import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'

export function isDirectExecution(
  entryPath: string | undefined,
  moduleFilename: string
): boolean {
  return Boolean(
    entryPath &&
    realpathSync(resolve(entryPath)) === realpathSync(moduleFilename)
  )
}
