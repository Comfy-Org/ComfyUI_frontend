import { readFile, realpath, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer, normalizePath } from 'vite'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const packageEntry = resolve(
  workspaceRoot,
  'packages/comfy-multi-player/src/index.ts'
)
const importer = resolve(
  workspaceRoot,
  'src/workbench/extensions/agent/crdt/schemaGuard.ts'
)
const hmrPort = 6216
let resolveHotUpdate: ((moduleIds: string[]) => void) | undefined
const hotUpdate = new Promise<string[]>((resolveUpdate) => {
  resolveHotUpdate = resolveUpdate
})

const server = await createServer({
  root: workspaceRoot,
  configFile: false,
  logLevel: 'silent',
  plugins: [
    {
      name: 'comfy-multi-player-hmr-proof',
      handleHotUpdate(context) {
        if (normalizePath(context.file) === normalizePath(packageEntry)) {
          resolveHotUpdate?.(context.modules.map((module) => module.id))
        }
      }
    }
  ],
  server: { hmr: true, port: hmrPort, strictPort: true },
  optimizeDeps: { noDiscovery: true }
})

let originalSource: string | undefined
try {
  await server.listen()

  const resolvedPackage = await server.pluginContainer.resolveId(
    '@comfyorg/comfy-multi-player',
    importer
  )
  if (!resolvedPackage) {
    throw new Error('Vite could not resolve @comfyorg/comfy-multi-player')
  }

  const resolvedPath = resolvedPackage.id.replace(/[?#].*$/, '')
  const [actualEntry, expectedEntry] = await Promise.all([
    realpath(resolvedPath),
    realpath(packageEntry)
  ])
  if (actualEntry !== expectedEntry) {
    throw new Error(
      `Vite resolved @comfyorg/comfy-multi-player to ${actualEntry}; expected workspace source ${expectedEntry}`
    )
  }

  const moduleUrl = `/@fs/${normalizePath(expectedEntry)}`
  const transformed = await server.transformRequest(moduleUrl)
  if (!transformed) {
    throw new Error(`Vite did not transform workspace source ${expectedEntry}`)
  }

  const watchedModules = server.moduleGraph.getModulesByFile(expectedEntry)
  if (!watchedModules?.size) {
    throw new Error(
      `Vite did not register workspace source ${expectedEntry} in its module graph`
    )
  }

  originalSource = await readFile(expectedEntry, 'utf8')
  await writeFile(
    expectedEntry,
    `${originalSource}\n// temporary comfy-multi-player HMR probe\n`
  )
  const updatedModules = await new Promise<string[]>(
    (resolveUpdate, reject) => {
      const timeout = setTimeout(
        () =>
          reject(new Error('Vite did not emit a package-source HMR update')),
        10_000
      )
      void hotUpdate.then((moduleIds) => {
        clearTimeout(timeout)
        resolveUpdate(moduleIds)
      })
    }
  )
  if (
    !updatedModules.some((id) => id.replace(/[?#].*$/, '') === expectedEntry)
  ) {
    throw new Error(
      `Vite HMR update did not include workspace source: ${updatedModules.join(', ')}`
    )
  }

  process.stdout.write(
    [
      `resolved=${normalizePath(actualEntry)}`,
      `module_graph_entries=${watchedModules.size}`,
      `hmr_port=${hmrPort}`,
      `hmr_module=${normalizePath(expectedEntry)}`,
      'workspace_source_hmr=verified'
    ].join('\n') + '\n'
  )
} finally {
  if (originalSource !== undefined) {
    await writeFile(packageEntry, originalSource)
  }
  await server.close()
}
