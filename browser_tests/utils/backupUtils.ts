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

const createScaffoldingCopy = (srcDir: string, destDir: string) => {
  // Get all items (files and directories) in the source directory
  const items = fs.readdirSync(srcDir, { withFileTypes: true })

  for (const item of items) {
    const srcPath = path.join(srcDir, item.name)
    const destPath = path.join(destDir, item.name)

    if (item.isDirectory()) {
      // Create the corresponding directory in the destination
      fs.ensureDirSync(destPath)

      // Recursively copy the directory structure
      createScaffoldingCopy(srcPath, destPath)
    }
  }
}

export function backupPath(
  pathParts: [string, ...string[]],
  { renameAndReplaceWithScaffolding = false } = {}
) {
  const resolvedPath = getPathIfExists(pathParts)
  if (!resolvedPath) return

  const backupPath = getBackupPath(resolvedPath)
  try {
    if (renameAndReplaceWithScaffolding) {
      // Rename the original path and create scaffolding in its place
      fs.moveSync(resolvedPath, backupPath)
      createScaffoldingCopy(backupPath, resolvedPath)
    } else {
      // Create a copy of the original path
      fs.copySync(resolvedPath, backupPath)
    }
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
