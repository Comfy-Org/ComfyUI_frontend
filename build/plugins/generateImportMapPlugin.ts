import glob from 'fast-glob'
import fs from 'fs-extra'
import { dirname, join } from 'node:path'
import { HtmlTagDescriptor, Plugin, normalizePath } from 'vite'

interface ImportMapSource {
  name: string
  pattern: string | RegExp
  entry: string
  recursiveDependence?: boolean
  override?: Record<string, Partial<ImportMapSource>>
}

const parseDeps = (root: string, pkg: string) => {
  const pkgPath = join(root, 'node_modules', pkg, 'package.json')
  if (fs.existsSync(pkgPath)) {
    const content = fs.readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(content)
    return Object.keys(pkg.dependencies || {})
  }
  return []
}

/**
 * Vite plugin that generates an import map for vendor chunks.
 *
 * This plugin creates a browser-compatible import map that maps module specifiers
 * (like 'vue' or 'primevue') to their actual file locations in the build output.
 * This improves module loading in modern browsers and enables better caching.
 *
 * The plugin:
 * 1. Tracks vendor chunks during bundle generation
 * 2. Creates mappings between module names and their file paths
 * 3. Injects an import map script tag into the HTML head
 * 4. Configures manual chunk splitting for vendor libraries
 *
 * @param vendorLibraries - An array of vendor libraries to split into separate chunks
 * @returns {Plugin} A Vite plugin that generates and injects an import map
 */
export function generateImportMapPlugin(
  importMapSources: ImportMapSource[]
): Plugin {
  const importMapEntries: Record<string, string> = {}
  const resolvedImportMapSources: Map<string, ImportMapSource> = new Map()
  const assetDir = 'assets/lib'
  let root: string

  return {
    name: 'generate-import-map-plugin',

    // Configure manual chunks during the build process
    configResolved(config) {
      root = config.root

      if (config.build) {
        // Ensure rollupOptions exists
        if (!config.build.rollupOptions) {
          config.build.rollupOptions = {}
        }

        for (const source of importMapSources) {
          resolvedImportMapSources.set(source.name, source)
          if (source.recursiveDependence) {
            const deps = parseDeps(root, source.name)

            while (deps.length) {
              const dep = deps.shift()!
              const depSource = Object.assign({}, source, {
                name: dep,
                pattern: dep,
                ...source.override?.[dep]
              })
              resolvedImportMapSources.set(depSource.name, depSource)

              const _deps = parseDeps(root, depSource.name)
              deps.unshift(..._deps)
            }
          }
        }

        const external: (string | RegExp)[] = []
        for (const [, source] of resolvedImportMapSources) {
          external.push(source.pattern)
        }
        config.build.rollupOptions.external = external
      }
    },

    generateBundle(_options) {
      for (const [, source] of resolvedImportMapSources) {
        if (source.entry) {
          const moduleFile = join(source.name, source.entry)
          const sourceFile = join(root, 'node_modules', moduleFile)
          const targetFile = join(root, 'dist', assetDir, moduleFile)

          importMapEntries[source.name] =
            './' + normalizePath(join(assetDir, moduleFile))

          const targetDir = dirname(targetFile)
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true })
          }
          fs.copyFileSync(sourceFile, targetFile)
        }

        if (source.recursiveDependence) {
          const files = glob.sync(['**/*.{js,mjs}'], {
            cwd: join(root, 'node_modules', source.name)
          })

          for (const file of files) {
            const moduleFile = join(source.name, file)
            const sourceFile = join(root, 'node_modules', moduleFile)
            const targetFile = join(root, 'dist', assetDir, moduleFile)

            importMapEntries[normalizePath(join(source.name, dirname(file)))] =
              './' + normalizePath(join(assetDir, moduleFile))

            const targetDir = dirname(targetFile)
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true })
            }
            fs.copyFileSync(sourceFile, targetFile)
          }
        }
      }
    },

    transformIndexHtml(html) {
      if (Object.keys(importMapEntries).length === 0) {
        console.warn(
          '[ImportMap Plugin] No vendor chunks found to create import map.'
        )
        return html
      }

      const importMap = {
        imports: importMapEntries
      }

      const importMapTag: HtmlTagDescriptor = {
        tag: 'script',
        attrs: { type: 'importmap' },
        children: JSON.stringify(importMap, null, 2),
        injectTo: 'head'
      }

      return {
        html,
        tags: [importMapTag]
      }
    }
  }
}
