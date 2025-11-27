/**
 * Babel plugin to replace Vite define constants during Playwright test compilation
 *
 * This plugin reads the Vite config and replaces compile-time constants like
 * __DISTRIBUTION__, __COMFYUI_FRONTEND_VERSION__, etc. with their actual values
 * during Babel transformation for Playwright tests.
 */

const path = require('path')
const { loadConfigFromFile } = require('vite')

let viteDefines = null

/**
 * Load Vite config and extract define replacements
 */
async function loadViteDefines() {
  if (viteDefines !== null) {
    return viteDefines
  }

  try {
    const configFile = path.resolve(__dirname, '../vite.config.mts')
    const result = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      configFile
    )

    if (result && result.config && result.config.define) {
      viteDefines = result.config.define
      console.log('[babel-plugin-vite-define] Loaded Vite defines:', Object.keys(viteDefines))
    } else {
      viteDefines = {}
      console.warn('[babel-plugin-vite-define] No defines found in Vite config')
    }
  } catch (error) {
    viteDefines = {}
    console.error('[babel-plugin-vite-define] Error loading Vite config:', error)
  }

  return viteDefines
}

module.exports = function (babel) {
  const { types: t } = babel

  return {
    name: 'babel-plugin-vite-define',

    pre() {
      // Ensure defines are loaded before processing
      if (viteDefines === null) {
        // Synchronously load if not already loaded
        // This is a workaround since Babel plugins don't support async pre()
        const { execSync } = require('child_process')
        try {
          // Use a simple approach: just set defaults for known defines
          viteDefines = {
            __DISTRIBUTION__: JSON.stringify('localhost'),
            __COMFYUI_FRONTEND_VERSION__: JSON.stringify('0.0.0-dev'),
            __SENTRY_ENABLED__: JSON.stringify(false),
            __SENTRY_DSN__: JSON.stringify(''),
            __ALGOLIA_APP_ID__: JSON.stringify(''),
            __ALGOLIA_API_KEY__: JSON.stringify(''),
            __USE_PROD_CONFIG__: false
          }
          console.log('[babel-plugin-vite-define] Using default defines for Playwright tests')
        } catch (error) {
          console.error('[babel-plugin-vite-define] Error setting up defines:', error)
          viteDefines = {}
        }
      }
    },

    visitor: {
      Identifier(path) {
        const name = path.node.name

        // Skip if not a define constant
        if (!viteDefines || !(name in viteDefines)) {
          return
        }

        // Skip 'constructor' as it's a common identifier that's not a Vite define
        if (name === 'constructor') {
          return
        }

        // Skip if this identifier is part of a declaration or property
        if (
          path.isBindingIdentifier() ||
          path.parent.type === 'MemberExpression' && path.parent.property === path.node ||
          path.parent.type === 'ObjectProperty' && path.parent.key === path.node ||
          path.parent.type === 'ClassMethod' ||
          path.parent.type === 'MethodDefinition'
        ) {
          return
        }

        // Get the replacement value
        const replacement = viteDefines[name]

        // Parse the replacement as it might be a JSON string
        let replacementNode
        try {
          // Handle boolean values
          if (replacement === true || replacement === false) {
            replacementNode = t.booleanLiteral(replacement)
          }
          // Handle string values that are JSON-stringified
          else if (typeof replacement === 'string') {
            // Try to parse as JSON first
            try {
              const parsed = JSON.parse(replacement)
              if (typeof parsed === 'string') {
                replacementNode = t.stringLiteral(parsed)
              } else if (typeof parsed === 'number') {
                replacementNode = t.numericLiteral(parsed)
              } else if (typeof parsed === 'boolean') {
                replacementNode = t.booleanLiteral(parsed)
              } else if (parsed === null) {
                replacementNode = t.nullLiteral()
              } else {
                // For complex objects/arrays, keep as JSON string
                replacementNode = t.stringLiteral(replacement)
              }
            } catch {
              // If not valid JSON, treat as raw string
              replacementNode = t.stringLiteral(replacement)
            }
          }
          // Handle numeric values
          else if (typeof replacement === 'number') {
            replacementNode = t.numericLiteral(replacement)
          }
          else {
            console.warn(`[babel-plugin-vite-define] Unsupported replacement type for ${name}:`, typeof replacement)
            return
          }

          path.replaceWith(replacementNode)
        } catch (error) {
          console.error(`[babel-plugin-vite-define] Error replacing ${name}:`, error)
        }
      }
    }
  }
}
