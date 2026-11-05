import { unlinkSync, writeFileSync } from 'node:fs'

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  )
}

export function writeFileExclusive(
  filePath: string,
  contents: string,
  replace: boolean
): void {
  if (replace) {
    try {
      unlinkSync(filePath)
    } catch (error) {
      if (!isFileNotFoundError(error)) throw error
    }
  }
  writeFileSync(filePath, contents, { flag: 'wx' })
}
