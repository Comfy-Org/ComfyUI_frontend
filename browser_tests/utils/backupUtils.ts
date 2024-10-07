import path from 'path'
import fs from 'fs-extra'

const getBackupPath = (originalPath: string): string => `${originalPath}.bak`

const getPathIfExists = (pathParts: [string, ...string[]]): string | null => {
  const resolvedPath = path.resolve(...pathParts)
  if (!fs.pathExistsSync(resolvedPath)) {
    console.warn(`Path not found: ${resolvedPath}`)
    return null
  }
  return resolvedPath
}

export function backupPath(pathParts: [string, ...string[]]) {
  const resolvedPath = getPathIfExists(pathParts)
  if (!resolvedPath) return

  const backupPath = getBackupPath(resolvedPath)
  try {
    fs.copySync(resolvedPath, backupPath)
  } catch (error) {
    console.error(`Failed to backup ${resolvedPath} to ${backupPath}`, error)
  }
}

export function restorePath(pathParts: [string, ...string[]]) {
  const resolvedPath = getPathIfExists(pathParts)
  if (!resolvedPath) return

  const backupPath = getBackupPath(resolvedPath)
  if (!fs.pathExistsSync(backupPath)) {
    console.warn(`Backup not found for: ${resolvedPath}, skipping restore.`)
    return
  }

  try {
    fs.moveSync(backupPath, resolvedPath, { overwrite: true })
  } catch (error) {
    console.error(`Failed to restore ${resolvedPath} from ${backupPath}`, error)
  }
}
