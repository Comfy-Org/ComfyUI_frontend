import path from 'path'
import { Plugin } from 'vite'

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
