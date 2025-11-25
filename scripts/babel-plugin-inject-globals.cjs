/**
 * Babel plugin to inject global setup imports into specific test files
 *
 * This plugin automatically adds an import for browser globals setup
 * at the beginning of files matching a specific pattern
 */

const nodePath = require('path')

module.exports = function (babel, options = {}) {
  const { filenamePattern = 'collect-i18n-', setupFile = './setup-i18n-globals.mjs' } = options

  return {
    name: 'babel-plugin-inject-globals',

    visitor: {
      Program: {
        enter(path, state) {
          const filename = state.file.opts.filename

          // Only process files matching the pattern
          if (!filename || !filename.includes(filenamePattern)) {
            return
          }

          // Check if setup import already exists
          const hasSetupImport = path.node.body.some(
            (node) =>
              node.type === 'ImportDeclaration' &&
              node.source.value.includes('setup-i18n-globals')
          )

          if (hasSetupImport) {
            return
          }

          // Create the import statement
          const importDeclaration = babel.types.importDeclaration(
            [],
            babel.types.stringLiteral(setupFile)
          )

          // Add the import at the beginning of the file
          path.node.body.unshift(importDeclaration)

          console.log(`[babel-plugin-inject-globals] Injected setup into ${nodePath.basename(filename)}`)
        }
      }
    }
  }
}
