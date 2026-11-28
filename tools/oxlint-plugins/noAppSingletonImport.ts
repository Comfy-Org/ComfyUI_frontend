import type { Rule } from './astTypes'

const APP_MODULE =
  /^(?:@\/scripts\/app|(?:\.{1,2}\/)+(?:scripts\/)?app)(?:\.[jt]s)?$/

export const noAppSingletonImport: Rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Reach the app through useApp() from @/scripts/appInstance instead of importing the singleton'
    },
    schema: [],
    messages: {
      singleton:
        "Do not import the `app` singleton. Call useApp() from '@/scripts/appInstance' so tests can supply their own app."
    }
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') return
        if (!APP_MODULE.test(node.source.value)) return
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.importKind !== 'type' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === 'app'
          ) {
            context.report({ node: specifier, messageId: 'singleton' })
          }
        }
      }
    }
  }
}
