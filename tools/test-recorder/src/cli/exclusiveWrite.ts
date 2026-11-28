import { randomUUID } from 'node:crypto'
import { renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

function removeIfPresent(filePath: string): unknown {
  try {
    rmSync(filePath, { force: true })
    return undefined
  } catch (error) {
    return error
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
    `.comfy-test.${process.pid}.${randomUUID()}.tmp`
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
