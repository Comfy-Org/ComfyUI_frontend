const DOM_INSPECTION_METHODS = new Set([
  'getComputedStyle',
  'querySelector',
  'querySelectorAll'
])

interface Node {
  readonly type: string
}

interface Identifier extends Node {
  readonly type: 'Identifier'
  readonly name: string
}

interface MemberExpression extends Node {
  readonly type: 'MemberExpression'
  readonly property: Node
}

interface CallExpression extends Node {
  readonly type: 'CallExpression'
  readonly callee: Node
}

interface RuleContext {
  readonly sourceCode: {
    getAncestors(node: Node): readonly Node[]
  }
  report(descriptor: { node: Node; message: string }): void
}

function calledIdentifier(node: CallExpression): string | undefined {
  return node.callee.type === 'Identifier'
    ? (node.callee as Identifier).name
    : undefined
}

function calledMethod(node: CallExpression): string | undefined {
  if (node.callee.type !== 'MemberExpression') return
  const property = (node.callee as MemberExpression).property
  return property.type === 'Identifier'
    ? (property as Identifier).name
    : undefined
}

function isComputedCall(node: Node): boolean {
  return (
    node.type === 'CallExpression' &&
    calledIdentifier(node as CallExpression) === 'computed'
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

        if (method === 'getBoundingClientRect') {
          context.report({
            node,
            message:
              'Do not measure the DOM inside a computed - every recompute becomes a layout read. Derive from a store instead. See docs/guidance/state-and-effects.md.'
          })
        } else if (DOM_INSPECTION_METHODS.has(method)) {
          context.report({
            node,
            message:
              'Do not inspect the DOM inside a computed. Derive from a store instead. See docs/guidance/state-and-effects.md.'
          })
        }
      }
    }
  }
}
