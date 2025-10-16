import path from 'path'
import type { Plugin } from 'vite'

interface ShimResult {
  code: string
  exports: string[]
}

type DeprecationInfo =
  | {
      /** Replacement API or migration guide text */
      replacement: string
      /** Version when this will be removed (e.g., 'v2.0.0') */
      removeVersion: string
      /** URL to migration guide (optional) */
      migrationUrl?: string

      skip?: false
    }
  | {
      skip: true
    }

/**
 * Map of deprecated file paths to their deprecation info.
 * Key format: relative path from src/ without extension
 */
const deprecatedFiles: Record<string, DeprecationInfo> = {
  all: {
    removeVersion: 'v1.33',
    // TODO: Update this
    replacement: 'Use the new API instead',
    // TODO: Update this
    migrationUrl: 'https://comfy.org'
  },
  'scripts/app': {
    skip: true
  },
  'scripts/api': {
    skip: true
  }
}

function isLegacyFile(id: string): boolean {
  return (
    id.endsWith('.ts') &&
    (id.includes('src/extensions/core') || id.includes('src/scripts'))
  )
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

export function comfyAPIPlugin(isDev: boolean): Plugin {
  return {
    name: 'comfy-api-plugin',
    transform(code: string, id: string) {
      if (isDev) return null

      if (isLegacyFile(id)) {
        const result = transformExports(code, id)

        if (result.exports.length > 0) {
          const projectRoot = process.cwd()
          const relativePath = path.relative(path.join(projectRoot, 'src'), id)
          const shimFileName = relativePath.replace(/\.ts$/, '.js')

          let shimContent = `// Shim for ${relativePath}\n`

          const fileKey = relativePath.replace(/\.ts$/, '').replace(/\\/g, '/')
          const deprecationInfo =
            deprecatedFiles[fileKey] || deprecatedFiles['all']
          if (deprecationInfo && deprecationInfo.skip != true) {
            let warningMessage = `[ComfyUI Deprecated] Importing from ${shimFileName} is deprecated. ${deprecationInfo.replacement}. This will be removed in ${deprecationInfo.removeVersion}.`

            if (deprecationInfo.migrationUrl) {
              warningMessage += ` See: ${deprecationInfo.migrationUrl}`
            }

            shimContent += `console.warn('${warningMessage}');\n`
          }

          shimContent += result.exports.join('')

          this.emitFile({
            type: 'asset',
            fileName: shimFileName,
            source: shimContent
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
