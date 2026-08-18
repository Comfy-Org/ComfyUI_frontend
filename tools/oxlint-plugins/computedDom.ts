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

function isIdentifier(node: Node): node is Identifier {
  return (
    node.type === 'Identifier' &&
    'name' in node &&
    typeof node.name === 'string'
  )
}

function isMemberExpression(node: Node): node is MemberExpression {
  return (
    node.type === 'MemberExpression' &&
    'property' in node &&
    typeof node.property === 'object' &&
    node.property !== null &&
    'type' in node.property &&
    typeof node.property.type === 'string'
  )
}

function isCallExpression(node: Node): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    'callee' in node &&
    typeof node.callee === 'object' &&
    node.callee !== null &&
    'type' in node.callee &&
    typeof node.callee.type === 'string'
  )
}

function calledIdentifier(node: CallExpression): string | undefined {
  return isIdentifier(node.callee) ? node.callee.name : undefined
}

function calledMethod(node: CallExpression): string | undefined {
  if (!isMemberExpression(node.callee)) return
  return isIdentifier(node.callee.property)
    ? node.callee.property.name
    : undefined
}

function isComputedCall(node: Node): boolean {
  return isCallExpression(node) && calledIdentifier(node) === 'computed'
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
