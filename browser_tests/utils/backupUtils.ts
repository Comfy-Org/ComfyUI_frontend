import fs from 'fs-extra'
import path from 'path'

type PathParts = readonly [string, ...string[]]

const getBackupPath = (originalPath: string): string => `${originalPath}.bak`

const resolvePathIfExists = (pathParts: PathParts): string | null => {
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
  pathParts: PathParts,
  { renameAndReplaceWithScaffolding = false } = {}
) {
  const originalPath = resolvePathIfExists(pathParts)
  if (!originalPath) return

  const backupPath = getBackupPath(originalPath)
  try {
    if (renameAndReplaceWithScaffolding) {
      // Rename the original path and create scaffolding in its place
      fs.moveSync(originalPath, backupPath)
      createScaffoldingCopy(backupPath, originalPath)
    } else {
      // Create a copy of the original path
      fs.copySync(originalPath, backupPath)
    }
  } catch (error) {
    console.error(`Failed to backup ${originalPath} from ${backupPath}`, error)
  }
}

function removeWithRetry(targetPath: string, retries = 3, delayMs = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      fs.removeSync(targetPath)
      return
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code
      if ((code === 'EPERM' || code === 'EBUSY') && attempt < retries) {
        console.warn(
          `Retry ${attempt}/${retries}: ${code} removing ${targetPath}`
        )
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs)
        continue
      }
      throw error
    }
  }
}

export function restorePath(pathParts: PathParts) {
  const originalPath = resolvePathIfExists(pathParts)
  if (!originalPath) return

  const backupPath = getBackupPath(originalPath)
  if (!fs.pathExistsSync(backupPath)) return

  try {
    removeWithRetry(originalPath)
    fs.moveSync(backupPath, originalPath)
  } catch (error) {
    console.warn(
      `Could not fully restore ${originalPath} from ${backupPath}:`,
      (error as NodeJS.ErrnoException).message
    )
  }
}
