import type { AnyNode, NodeOf, Rule } from './astTypes'

type FunctionNode = NodeOf<
  'ArrowFunctionExpression' | 'FunctionDeclaration' | 'FunctionExpression'
>

function nearestFunction(node: AnyNode): FunctionNode | undefined {
  for (
    let current = node;
    current.type !== 'Program';
    current = current.parent
  ) {
    if (
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression'
    ) {
      return current
    }
  }
  return undefined
}

function isPollCallback(fn: FunctionNode): boolean {
  const call = fn.parent
  if (call.type !== 'CallExpression' || call.arguments[0] !== fn) return false
  const { callee } = call
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'poll' &&
    callee.object.type === 'Identifier' &&
    /expect$/i.test(callee.object.name)
  )
}

export const noThrowInExpectPoll: Rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Return a retryable value from an expect.poll callback instead of throwing'
    },
    schema: [],
    messages: {
      throwInPoll:
        'A throw inside an expect.poll callback fails on the first tick instead of retrying. Return a sentinel value (for example undefined or null) and let the matcher retry.'
    }
  },
  create(context) {
    return {
      ThrowStatement(node) {
        const fn = nearestFunction(node.parent)
        if (fn && isPollCallback(fn)) {
          context.report({ node, messageId: 'throwInPoll' })
        }
      }
    }
  }
}
