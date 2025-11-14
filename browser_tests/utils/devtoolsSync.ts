import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

export function syncDevtools(targetComfyDir: string): boolean {
  if (!targetComfyDir) {
    console.warn('syncDevtools skipped: TEST_COMFYUI_DIR not set')
    return false
  }

  // Validate and sanitize the target directory path
  const resolvedTargetDir = path.resolve(targetComfyDir)

  // Basic path validation to prevent directory traversal
  if (resolvedTargetDir.includes('..') || !path.isAbsolute(resolvedTargetDir)) {
    console.error('syncDevtools failed: Invalid target directory path')
    return false
  }

  const moduleDir =
    typeof __dirname !== 'undefined'
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url))

  const devtoolsSrc = path.resolve(moduleDir, '..', '..', 'tools', 'devtools')

  if (!fs.pathExistsSync(devtoolsSrc)) {
    console.warn(
      `syncDevtools skipped: source directory not found at ${devtoolsSrc}`
    )
    return false
  }

  const devtoolsDest = path.resolve(
    resolvedTargetDir,
    'custom_nodes',
    'ComfyUI_devtools'
  )

  console.warn(`syncDevtools: copying ${devtoolsSrc} -> ${devtoolsDest}`)

  try {
    fs.removeSync(devtoolsDest)
    fs.ensureDirSync(devtoolsDest)
    fs.copySync(devtoolsSrc, devtoolsDest, { overwrite: true })
    console.warn('syncDevtools: copy complete')
    return true
  } catch (error) {
    console.error(`Failed to sync DevTools to ${devtoolsDest}:`, error)
    return false
  }
}
