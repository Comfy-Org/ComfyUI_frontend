import type { AnyNode, Rule } from './astTypes'

const HOISTED_CALLBACK_METHODS = new Set(['doMock', 'hoisted', 'mock'])

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

function isReadByHoistedCode(identifier: AnyNode): boolean {
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
      HOISTED_CALLBACK_METHODS.has(method) &&
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
      description: 'Use vi.hoisted only for values hoisted mock code reads'
    },
    schema: [],
    messages: {
      unreadHoisted:
        "'{{ name }}' comes from vi.hoisted but no vi.mock factory or other vi.hoisted callback reads it. Declare it as a plain const, or configure the mocked module through vi.mocked(importedFn)."
    }
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (viMethod(node.init) !== 'hoisted') return
        for (const variable of context.sourceCode.getDeclaredVariables(node)) {
          const readByHoistedCode = variable.references.some((reference) =>
            isReadByHoistedCode(reference.identifier)
          )
          if (!readByHoistedCode) {
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
