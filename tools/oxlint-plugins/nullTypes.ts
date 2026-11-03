import type { Rule } from './astTypes'

export const noNullType: Rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer undefined in new type signatures'
    },
    schema: [],
    messages: {
      forbidden:
        'Use undefined instead of null in new type signatures. Derive required nullable contracts from their existing types.'
    }
  },
  create(context) {
    return {
      TSNullKeyword(node) {
        context.report({ node, messageId: 'forbidden' })
      }
    }
  }
}
