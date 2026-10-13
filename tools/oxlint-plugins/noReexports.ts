import type { Rule } from './astTypes'

const SOURCE_MODULE = /^(?:\.{1,2}\/|@\/)/

function isSourceModule(source: { readonly value: unknown } | null): boolean {
  return typeof source?.value === 'string' && SOURCE_MODULE.test(source.value)
}

export const noReexports: Rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Import from the defining source module instead of re-exporting it through another one'
    },
    schema: [],
    messages: {
      reexport:
        'Do not re-export another source module. Import from the module that defines it; see docs/guidance/engineering.md (no barrel files).'
    }
  },
  create(context) {
    const sourceImports = new Set<string>()
    const reportsIfImported: { name: string; report: () => void }[] = []

    return {
      ImportDeclaration(node) {
        if (!isSourceModule(node.source)) return
        for (const specifier of node.specifiers) {
          sourceImports.add(specifier.local.name)
        }
      },
      ExportAllDeclaration(node) {
        if (isSourceModule(node.source)) {
          context.report({ node, messageId: 'reexport' })
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          if (isSourceModule(node.source)) {
            context.report({ node, messageId: 'reexport' })
          }
          return
        }
        if (node.declaration) return
        for (const specifier of node.specifiers) {
          if (specifier.local.type !== 'Identifier') continue
          reportsIfImported.push({
            name: specifier.local.name,
            report: () =>
              context.report({ node: specifier, messageId: 'reexport' })
          })
        }
      },
      ExportDefaultDeclaration(node) {
        const { declaration } = node
        if (declaration.type !== 'Identifier') return
        reportsIfImported.push({
          name: declaration.name,
          report: () => context.report({ node, messageId: 'reexport' })
        })
      },
      'Program:exit'() {
        for (const { name, report } of reportsIfImported) {
          if (sourceImports.has(name)) report()
        }
      }
    }
  }
}
