import type { CallExpression, Node, RuleContext } from './oxlintPluginTypes'

const INSPECTION_MESSAGE =
  'Do not inspect the DOM inside a computed. Derive from a store instead. See docs/guidance/state-and-effects.md.'
const DOM_METHOD_MESSAGES = new Map([
  [
    'getBoundingClientRect',
    'Do not measure the DOM inside a computed - every recompute becomes a layout read. Derive from a store instead. See docs/guidance/state-and-effects.md.'
  ],
  ['getComputedStyle', INSPECTION_MESSAGE],
  ['querySelector', INSPECTION_MESSAGE],
  ['querySelectorAll', INSPECTION_MESSAGE]
])

function calledMethod(node: CallExpression): string | undefined {
  const { callee } = node
  if (callee.type !== 'MemberExpression') return
  return callee.property?.type === 'Identifier'
    ? callee.property.name
    : undefined
}

function isComputedCall(node: Node): boolean {
  return (
    node.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === 'computed'
  )
}

export const noDomInComputed = {
  create(context: RuleContext) {
    return {
      CallExpression(node: CallExpression) {
        const method = calledMethod(node)
        if (
          method === undefined ||
          !context.sourceCode.getAncestors(node).some(isComputedCall)
        ) {
          return
        }
        const message = DOM_METHOD_MESSAGES.get(method)
        if (message !== undefined) context.report({ node, message })
      }
    }
  }
}
