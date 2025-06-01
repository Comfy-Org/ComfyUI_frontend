import type { OutputOptions } from 'rollup'
import { HtmlTagDescriptor, Plugin } from 'vite'

interface VendorLibrary {
  name: string
  pattern: RegExp
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
  vendorLibraries: VendorLibrary[]
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
              if (lib.pattern.test(id)) {
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
