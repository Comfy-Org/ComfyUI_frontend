import type { AnyNode, Rule } from './astTypes'

const MOCK_FACTORY_METHODS = new Set(['doMock', 'mock'])

function viMethod(node: AnyNode | null): string | undefined {
  if (node?.type !== 'CallExpression') return undefined
  const { callee } = node
  return callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'vi' &&
    callee.property.type === 'Identifier'
    ? callee.property.name
    : undefined
}

function isInsideMockFactory(identifier: AnyNode): boolean {
  for (
    let current = identifier;
    current.type !== 'Program';
    current = current.parent
  ) {
    const { parent } = current
    const method = viMethod(parent)
    if (
      parent.type === 'CallExpression' &&
      method !== undefined &&
      MOCK_FACTORY_METHODS.has(method) &&
      parent.arguments.some((argument) => argument === current)
    ) {
      return true
    }
  }
  return false
}

export const noUnreadHoistedMockState: Rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use vi.hoisted only for values a vi.mock factory reads'
    },
    schema: [],
    messages: {
      unreadHoisted:
        "'{{ name }}' comes from vi.hoisted but no vi.mock factory reads it. Declare it as a plain const, or configure the mocked module through vi.mocked(importedFn)."
    }
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (viMethod(node.init) !== 'hoisted') return
        for (const variable of context.sourceCode.getDeclaredVariables(node)) {
          const readByFactory = variable.references.some((reference) =>
            isInsideMockFactory(reference.identifier)
          )
          if (!readByFactory) {
            context.report({
              node: variable.identifiers[0] ?? node,
              messageId: 'unreadHoisted',
              data: { name: variable.name }
            })
          }
        }
      }
    }
  }
}
