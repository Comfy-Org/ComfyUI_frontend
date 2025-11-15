import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

export function syncDevtools(targetComfyDir: string) {
  if (!targetComfyDir) {
    console.warn('syncDevtools skipped: TEST_COMFYUI_DIR not set')
    return
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
    return
  }

  const devtoolsDest = path.resolve(
    targetComfyDir,
    'custom_nodes',
    'ComfyUI_devtools'
  )

  console.warn(`syncDevtools: copying ${devtoolsSrc} -> ${devtoolsDest}`)

  try {
    fs.removeSync(devtoolsDest)
    fs.ensureDirSync(devtoolsDest)
    fs.copySync(devtoolsSrc, devtoolsDest, { overwrite: true })
    console.warn('syncDevtools: copy complete')
  } catch (error) {
    console.error(`Failed to sync DevTools to ${devtoolsDest}:`, error)
  }
}
