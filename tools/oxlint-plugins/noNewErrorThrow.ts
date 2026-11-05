import type { RuleTester } from 'oxlint/plugins-dev'

type Rule = Parameters<RuleTester['run']>[1]

export const noNewErrorThrow: Rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent new direct Error throws in production code'
    },
    schema: [],
    messages: {
      forbidden:
        'Do not add `throw new Error(...)` in production code. Return the failure as a value and report it at the ownership boundary; see docs/guidance/error-handling.md and ADR-TELEMETRY-DIAGNOSTICS-0019.'
    }
  },
  create(context) {
    return {
      ThrowStatement(node) {
        const expression = node.argument
        if (
          expression.type !== 'NewExpression' ||
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
