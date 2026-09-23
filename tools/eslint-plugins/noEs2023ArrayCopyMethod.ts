import type { TSESTree } from '@typescript-eslint/utils'
import type { ESLint, Rule } from 'eslint'

const es2023ArrayCopyMethods = new Set([
  'toReversed',
  'toSorted',
  'toSpliced',
  'with'
])

type Property = TSESTree.MemberExpression['property']

function getLiteralName(property: Property): string | undefined {
  if (property.type !== 'Literal' || typeof property.value !== 'string') return
  return property.value
}

function getTemplateName(property: Property): string | undefined {
  if (property.type !== 'TemplateLiteral' || property.expressions.length) return
  return property.quasis[0].value.cooked ?? undefined
}

function getStaticMethodName(
  member: TSESTree.MemberExpression
): string | undefined {
  const { property } = member
  if (!member.computed)
    return property.type === 'Identifier' ? property.name : undefined
  return getLiteralName(property) ?? getTemplateName(property)
}

function isArrayCopyMethod(methodName: string | undefined): boolean {
  return methodName !== undefined && es2023ArrayCopyMethods.has(methodName)
}

const noEs2023ArrayCopyMethod: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      unsupported:
        'ES2023 array method is not polyfilled for build target es2022; use the matching ES2022-safe non-mutating equivalent.'
    }
  },
  create(context) {
    function reportArrayCopyMethod(node: TSESTree.CallExpression) {
      if (node.callee.type !== 'MemberExpression') return
      if (!isArrayCopyMethod(getStaticMethodName(node.callee))) return
      context.report({
        node: node as unknown as Rule.Node,
        messageId: 'unsupported'
      })
    }

    return {
      CallExpression(node) {
        reportArrayCopyMethod(node as unknown as TSESTree.CallExpression)
      }
    }
  }
}

export const es2022CompatPlugin: ESLint.Plugin = {
  rules: { 'no-array-copy-method': noEs2023ArrayCopyMethod }
}
