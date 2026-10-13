import type { NodeOf, Rule } from './astTypes'

type ArrayElement = NodeOf<'ArrayExpression'>['elements'][number]
type CallNode = NodeOf<'CallExpression'>

const SORT_METHODS = new Set(['sort', 'toSorted'])

function defaultSortOfLiteral(
  node: CallNode
): { method: string; elements: readonly ArrayElement[] } | undefined {
  const { callee } = node
  if (
    node.arguments.length > 0 ||
    callee.type !== 'MemberExpression' ||
    callee.computed ||
    callee.property.type !== 'Identifier' ||
    !SORT_METHODS.has(callee.property.name) ||
    callee.object.type !== 'ArrayExpression'
  ) {
    return undefined
  }
  return { method: callee.property.name, elements: callee.object.elements }
}

function sortKey(element: ArrayElement): string | undefined {
  if (element?.type === 'Literal') {
    const { value } = element
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : undefined
  }
  if (element?.type === 'TemplateLiteral' && element.expressions.length === 0) {
    return element.quasis[0]?.value.cooked ?? undefined
  }
  return undefined
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1
  return left > right ? 1 : 0
}

export const noSortedLiteralArray: Rule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Write a literal array in the order the test needs instead of sorting it at runtime'
    },
    schema: [],
    messages: {
      sortedLiteral:
        'Write this literal array in sorted order instead of calling .{{ method }}() on it.'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        const sortCall = defaultSortOfLiteral(node)
        if (!sortCall) return
        const keyed = sortCall.elements.map((element) => ({
          element,
          key: sortKey(element)
        }))
        if (keyed.length === 0 || keyed.some(({ key }) => key === undefined)) {
          return
        }
        const sortedSource = keyed
          .toSorted((left, right) =>
            compareCodeUnits(left.key ?? '', right.key ?? '')
          )
          .map(({ element }) =>
            element ? context.sourceCode.getText(element) : ''
          )
          .join(', ')
        context.report({
          node,
          messageId: 'sortedLiteral',
          data: { method: sortCall.method },
          fix: (fixer) => fixer.replaceText(node, `[${sortedSource}]`)
        })
      }
    }
  }
}
