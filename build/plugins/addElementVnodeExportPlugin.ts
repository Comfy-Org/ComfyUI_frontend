import { Plugin } from 'vite'

/**
 * Vite plugin that adds an alias export for Vue's createBaseVNode as createElementVNode.
 *
 * This plugin addresses compatibility issues where some components or libraries
 * might be using the older createElementVNode function name instead of createBaseVNode.
 * It modifies the Vue vendor chunk during build to add the alias export.
 *
 * @returns {Plugin} A Vite plugin that modifies the Vue vendor chunk exports
 */
export function addElementVnodeExportPlugin(): Plugin {
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
