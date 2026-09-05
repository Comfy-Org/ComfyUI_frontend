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
          resolveHotUpdate?.(
            context.modules
              .map((module) => module.id)
              .filter((id) => id !== null)
          )
        }
      }
    }
  ],
  // Mirrors the `@` alias in `vite.config.mts`. The guard runs with
  // `configFile: false` for isolation, so the importer's own non-package
  // imports (`@/base/assert`) would otherwise fail to resolve and the
  // importer-edge assertion below could never run. Only the importer's direct
  // imports are resolved here, so this one entry is sufficient; an importer
  // that grows an import behind another alias fails the guard loudly rather
  // than silently skipping the edge check.
  resolve: { alias: { '@': '/src' } },
  server: { hmr: true, port: hmrPort, strictPort: true },
  optimizeDeps: { noDiscovery: true }
})

let originalSource: string | undefined
let probeTarget: string | undefined
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

  // Transform the real frontend importer, not just the package entry: a
  // registered package entry only proves Vite knows the file, while the
  // property under test is that `schemaGuard.ts` reaches the workspace source,
  // so an HMR update of that source invalidates frontend modules.
  const importerUrl = `/@fs/${normalizePath(importer)}`
  const transformedImporter = await server.transformRequest(importerUrl)
  if (!transformedImporter) {
    throw new Error(`Vite did not transform frontend importer ${importer}`)
  }

  const importerModules = server.moduleGraph.getModulesByFile(importer)
  const importerModule = importerModules && [...importerModules][0]
  if (!importerModule) {
    throw new Error(
      `Vite did not register frontend importer ${importer} in its module graph`
    )
  }

  const importedFiles = await Promise.all(
    [...importerModule.importedModules].map(async (module) =>
      module.file ? realpath(module.file).catch(() => module.file) : null
    )
  )
  if (
    !importedFiles.some(
      (file) =>
        file !== null && normalizePath(file) === normalizePath(expectedEntry)
    )
  ) {
    throw new Error(
      `Frontend importer ${importer} does not import workspace source ${expectedEntry}; imports: ${importedFiles.filter((file) => file !== null).join(', ')}`
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

  probeTarget = expectedEntry
  originalSource = await readFile(expectedEntry, 'utf8')
  await writeFile(
    expectedEntry,
    `${originalSource}\n// temporary comfy-multi-player HMR probe\n`
  )
  // Drive Vite's watcher pipeline directly so the proof does not depend on
  // host-specific filesystem event latency in CI.
  server.watcher.emit('change', expectedEntry)
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
      `importer=${normalizePath(importer)}`,
      `importer_imports_workspace_source=verified`,
      `module_graph_entries=${watchedModules.size}`,
      `hmr_port=${hmrPort}`,
      `hmr_module=${normalizePath(expectedEntry)}`,
      'workspace_source_hmr=verified'
    ].join('\n') + '\n'
  )
} finally {
  if (originalSource !== undefined && probeTarget !== undefined) {
    // Restore the path the probe actually wrote (the resolved entry), not the
    // unresolved `packageEntry`, so a symlinked checkout cannot leave the probe
    // comment behind in the real source file.
    await writeFile(probeTarget, originalSource)
  }
  await server.close()
}
