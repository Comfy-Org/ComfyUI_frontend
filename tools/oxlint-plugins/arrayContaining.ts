import type { NodeOf, Rule } from './astTypes'

type CallNode = NodeOf<'CallExpression'>
type ArrayElement = NodeOf<'ArrayExpression'>['elements'][number]

const SORT_METHODS = new Set(['sort', 'toSorted'])

function isDefaultSort(
  node: CallNode['arguments'][number] | CallNode['callee']
): node is CallNode {
  return (
    node.type === 'CallExpression' &&
    node.arguments.length === 0 &&
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier' &&
    SORT_METHODS.has(node.callee.property.name)
  )
}

function isStaticElement(element: ArrayElement): boolean {
  if (element?.type === 'Literal') {
    return (
      typeof element.value === 'string' || typeof element.value === 'number'
    )
  }
  return element?.type === 'TemplateLiteral' && element.expressions.length === 0
}

function isSortedLiteral(node: CallNode): boolean {
  if (!isDefaultSort(node) || node.callee.type !== 'MemberExpression') {
    return false
  }
  const { object } = node.callee
  return (
    object.type === 'ArrayExpression' &&
    object.elements.length > 0 &&
    object.elements.every(isStaticElement)
  )
}

function isExpectSubject(node: CallNode): boolean {
  const { parent } = node
  return (
    parent.type === 'CallExpression' &&
    parent.callee.type === 'Identifier' &&
    parent.callee.name === 'expect' &&
    parent.arguments[0] === node
  )
}

export const preferArrayContaining: Rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Compare arrays without regard to order through expect.arrayContaining instead of sorting'
    },
    schema: [],
    messages: {
      sortedComparison:
        'Do not sort to compare arrays without regard to order. Use expect(actual).toEqual(expect.arrayContaining([...])), and add toHaveLength when extra items must fail.'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isDefaultSort(node)) return
        if (isExpectSubject(node) || isSortedLiteral(node)) {
          context.report({ node, messageId: 'sortedComparison' })
        }
      }
    }
  }
}
