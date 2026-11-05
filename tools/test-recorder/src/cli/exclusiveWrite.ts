import { randomUUID } from 'node:crypto'
import { renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  )
}

function removeIfPresent(filePath: string): unknown {
  try {
    unlinkSync(filePath)
    return undefined
  } catch (error) {
    return isFileNotFoundError(error) ? undefined : error
  }
}

export function writeFileExclusive(
  filePath: string,
  contents: string,
  replace: boolean
): void {
  if (!replace) {
    writeFileSync(filePath, contents, { flag: 'wx' })
    return
  }

  const temporaryPath = join(
    dirname(filePath),
    `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  )
  try {
    writeFileSync(temporaryPath, contents, { flag: 'wx' })
    renameSync(temporaryPath, filePath)
  } catch (error) {
    const cleanupError = removeIfPresent(temporaryPath)
    if (cleanupError !== undefined && error instanceof Error) {
      error.cause ??= cleanupError
    }
    throw error
  }
}
