import type { Rule } from 'eslint'

export const noNewErrorThrow: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent new direct Error throws in production code'
    },
    schema: [],
    messages: {
      forbidden:
        'Do not add `throw new Error(...)` in production code. Use the recoverable diagnostics contract from ADR RED.'
    }
  },
  create(context) {
    return {
      ThrowStatement(node) {
        const expression = node.argument
        if (
          expression?.type !== 'NewExpression' ||
          expression.callee.type !== 'Identifier' ||
          expression.callee.name !== 'Error' ||
          !context.sourceCode.isGlobalReference(expression.callee)
        ) {
          return
        }

        context.report({ node: expression, messageId: 'forbidden' })
      }
    }
  }
}
