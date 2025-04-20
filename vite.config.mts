import vue from '@vitejs/plugin-vue'
import dotenv from 'dotenv'
import path from 'path'
import type { OutputOptions } from 'rollup'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { HtmlTagDescriptor, Plugin, defineConfig } from 'vite'
import type { UserConfigExport } from 'vitest/config'

dotenv.config()

const IS_DEV = process.env.NODE_ENV === 'development'
const SHOULD_MINIFY = process.env.ENABLE_MINIFY === 'true'
// vite dev server will listen on all addresses, including LAN and public addresses
const VITE_REMOTE_DEV = process.env.VITE_REMOTE_DEV === 'true'

interface ShimResult {
  code: string
  exports: string[]
}

function isLegacyFile(id: string): boolean {
  return (
    id.endsWith('.ts') &&
    (id.includes('src/extensions/core') || id.includes('src/scripts'))
  )
}

/**
 * Vite plugin that adds an alias export for Vue's createBaseVNode as createElementVNode.
 *
 * This plugin addresses compatibility issues where some components or libraries
 * might be using the older createElementVNode function name instead of createBaseVNode.
 * It modifies the Vue vendor chunk during build to add the alias export.
 *
 * @returns {Plugin} A Vite plugin that modifies the Vue vendor chunk exports
 */
function addElementVnodeExportPlugin(): Plugin {
  return {
    name: 'add-element-vnode-export-plugin',

    renderChunk(code, chunk, _options) {
      if (chunk.name.startsWith('vendor-vue')) {
        const exportRegex = /(export\s*\{)([^}]*)(\}\s*;?\s*)$/
        const match = code.match(exportRegex)

        if (match) {
          const existingExports = match[2].trim()
          const exportsArray = existingExports
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean)

          const hasCreateBaseVNode = exportsArray.some((e) =>
            e.startsWith('createBaseVNode')
          )
          const hasCreateElementVNode = exportsArray.some((e) =>
            e.includes('createElementVNode')
          )

          if (hasCreateBaseVNode && !hasCreateElementVNode) {
            const newExportStatement = `${match[1]} ${existingExports ? existingExports + ',' : ''} createBaseVNode as createElementVNode ${match[3]}`
            const newCode = code.replace(exportRegex, newExportStatement)

            console.log(
              `[add-element-vnode-export-plugin] Added 'createBaseVNode as createElementVNode' export to vendor-vue chunk.`
            )

            return { code: newCode, map: null }
          } else if (!hasCreateBaseVNode) {
            console.warn(
              `[add-element-vnode-export-plugin] Warning: 'createBaseVNode' not found in exports of vendor-vue chunk. Cannot add alias.`
            )
          }
        } else {
          console.warn(
            `[add-element-vnode-export-plugin] Warning: Could not find expected export block format in vendor-vue chunk.`
          )
        }
      }

      return null
    }
  }
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
function generateImportMapPlugin(
  vendorLibraries: { name: string; pattern: string }[]
): Plugin {
  const importMapEntries: Record<string, string> = {}

  return {
    name: 'generate-import-map-plugin',

    // Configure manual chunks during the build process
    configResolved(config) {
      if (config.build) {
        // Ensure rollupOptions exists
        if (!config.build.rollupOptions) {
          config.build.rollupOptions = {}
        }

        const outputOptions: OutputOptions = {
          manualChunks: (id: string) => {
            for (const lib of vendorLibraries) {
              if (id.includes(lib.pattern)) {
                return `vendor-${lib.name}`
              }
            }
            return null
          },
          // Disable minification of internal exports to preserve function names
          minifyInternalExports: false
        }
        config.build.rollupOptions.output = outputOptions
      }
    },

    generateBundle(_options, bundle) {
      for (const fileName in bundle) {
        const chunk = bundle[fileName]
        if (chunk.type === 'chunk' && !chunk.isEntry) {
          // Find matching vendor library by chunk name
          const vendorLib = vendorLibraries.find(
            (lib) => chunk.name === `vendor-${lib.name}`
          )

          if (vendorLib) {
            const relativePath = `./${chunk.fileName.replace(/\\/g, '/')}`
            importMapEntries[vendorLib.name] = relativePath

            console.log(
              `[ImportMap Plugin] Found chunk: ${chunk.name} -> Mapped '${vendorLib.name}' to '${relativePath}'`
            )
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

function comfyAPIPlugin(): Plugin {
  return {
    name: 'comfy-api-plugin',
    transform(code: string, id: string) {
      if (IS_DEV) return null

      if (isLegacyFile(id)) {
        const result = transformExports(code, id)

        if (result.exports.length > 0) {
          const projectRoot = process.cwd()
          const relativePath = path.relative(path.join(projectRoot, 'src'), id)
          const shimFileName = relativePath.replace(/\.ts$/, '.js')

          const shimComment = `// Shim for ${relativePath}\n`

          this.emitFile({
            type: 'asset',
            fileName: shimFileName,
            source: shimComment + result.exports.join('')
          })
        }

        return {
          code: result.code,
          map: null // If you're not modifying the source map, return null
        }
      }
    }
  }
}

function transformExports(code: string, id: string): ShimResult {
  const moduleName = getModuleName(id)
  const exports: string[] = []
  let newCode = code

  // Regex to match different types of exports
  const regex =
    /export\s+(const|let|var|function|class|async function)\s+([a-zA-Z$_][a-zA-Z\d$_]*)(\s|\()/g
  let match

  while ((match = regex.exec(code)) !== null) {
    const name = match[2]
    // All exports should be bind to the window object as new API endpoint.
    if (exports.length == 0) {
      newCode += `\nwindow.comfyAPI = window.comfyAPI || {};`
      newCode += `\nwindow.comfyAPI.${moduleName} = window.comfyAPI.${moduleName} || {};`
    }
    newCode += `\nwindow.comfyAPI.${moduleName}.${name} = ${name};`
    exports.push(
      `export const ${name} = window.comfyAPI.${moduleName}.${name};\n`
    )
  }

  return {
    code: newCode,
    exports
  }
}

function getModuleName(id: string): string {
  // Simple example to derive a module name from the file path
  const parts = id.split('/')
  const fileName = parts[parts.length - 1]
  return fileName.replace(/\.\w+$/, '') // Remove file extension
}

const DEV_SERVER_COMFYUI_URL =
  process.env.DEV_SERVER_COMFYUI_URL || 'http://127.0.0.1:8188'

export default defineConfig({
  base: '',
  server: {
    host: VITE_REMOTE_DEV ? '0.0.0.0' : undefined,
    proxy: {
      '/internal': {
        target: DEV_SERVER_COMFYUI_URL
      },

      '/api': {
        target: DEV_SERVER_COMFYUI_URL,
        // Return empty array for extensions API as these modules
        // are not on vite's dev server.
        bypass: (req, res, _options) => {
          if (req.url === '/api/extensions') {
            res.end(JSON.stringify([]))
          }
          return null
        }
      },

      '/ws': {
        target: DEV_SERVER_COMFYUI_URL,
        ws: true
      },

      '/workflow_templates': {
        target: DEV_SERVER_COMFYUI_URL
      },

      '/testsubrouteindex': {
        target: 'http://localhost:5173',
        rewrite: (path) => path.substring('/testsubrouteindex'.length)
      }
    }
  },

  plugins: [
    vue(),
    comfyAPIPlugin(),
    generateImportMapPlugin([
      { name: 'vue', pattern: 'node_modules/vue/' },
      { name: 'primevue', pattern: 'node_modules/primevue/' }
    ]),
    addElementVnodeExportPlugin(),

    Icons({
      compiler: 'vue3'
    }),

    Components({
      dts: true,
      resolvers: [IconsResolver()],
      dirs: ['src/components', 'src/layout', 'src/views'],
      deep: true,
      extensions: ['vue']
    })
  ],

  build: {
    minify: SHOULD_MINIFY ? 'esbuild' : false,
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // Disabling tree-shaking
      // Prevent vite remove unused exports
      treeshake: false
    }
  },

  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
    minifySyntax: SHOULD_MINIFY,
    minifyWhitespace: SHOULD_MINIFY
  },

  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts']
  },

  define: {
    __COMFYUI_FRONTEND_VERSION__: JSON.stringify(
      process.env.npm_package_version
    ),
    __SENTRY_ENABLED__: JSON.stringify(
      !(process.env.NODE_ENV === 'development' || !process.env.SENTRY_DSN)
    ),
    __SENTRY_DSN__: JSON.stringify(process.env.SENTRY_DSN || ''),
    __ALGOLIA_APP_ID__: JSON.stringify(process.env.ALGOLIA_APP_ID || ''),
    __ALGOLIA_API_KEY__: JSON.stringify(process.env.ALGOLIA_API_KEY || ''),
    __USE_PROD_FIREBASE_CONFIG__:
      process.env.USE_PROD_FIREBASE_CONFIG === 'true'
  },

  resolve: {
    alias: {
      '@': '/src'
    }
  },

  optimizeDeps: {
    exclude: ['@comfyorg/litegraph', '@comfyorg/comfyui-electron-types']
  }
}) as UserConfigExport
