import type { Rule } from 'eslint'

export const noPrimeVueImports: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow new PrimeVue imports'
    },
    messages: {
      banned:
        'New PrimeVue usage is banned per the PrimeVue removal effort. Remove this import. scripts/primevue-import-allowlist.ts is generated and only shrinks; do not add entries.'
    },
    schema: []
  },
  create(context) {
    function reportIfPrimeVueImport(node: Rule.Node, source: unknown) {
      if (
        typeof source === 'string' &&
        /^(?:primevue(?:\/|$)|@primevue(?:\/|$))/.test(source)
      ) {
        context.report({ node, messageId: 'banned' })
      }
    }

    return {
      ImportDeclaration(node) {
        reportIfPrimeVueImport(node, node.source.value)
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal') {
          reportIfPrimeVueImport(node, node.source.value)
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source) reportIfPrimeVueImport(node, node.source.value)
      },
      ExportAllDeclaration(node) {
        reportIfPrimeVueImport(node, node.source.value)
      }
    }
  }
}
