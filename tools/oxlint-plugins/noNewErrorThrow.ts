import type { RuleTester } from 'oxlint/plugins-dev'

type Rule = Parameters<RuleTester['run']>[1]

export const noNewErrorThrow: Rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent throw statements in production code'
    },
    schema: [],
    messages: {
      forbidden:
        'Do not add `throw` statements in production code, regardless of the thrown value. Return the failure as a value and report it at the ownership boundary; see docs/guidance/error-handling.md and ADR-TELEMETRY-DIAGNOSTICS-0019.'
    }
  },
  create(context) {
    return {
      ThrowStatement(node) {
        context.report({ node, messageId: 'forbidden' })
      }
    }
  }
}
