import type { TSESTree } from '@typescript-eslint/utils'
import type { ESLint, Rule } from 'eslint'

const es2023ArrayCopyMethods = new Set([
  'toReversed',
  'toSorted',
  'toSpliced',
  'with'
])

function getIdentifierName(
  member: TSESTree.MemberExpression
): string | undefined {
  if (member.computed) return
  if (member.property.type !== 'Identifier') return
  return member.property.name
}

function getLiteralName(member: TSESTree.MemberExpression): string | undefined {
  if (!member.computed) return
  if (member.property.type !== 'Literal') return
  return typeof member.property.value === 'string'
    ? member.property.value
    : undefined
}

function getTemplateName(
  member: TSESTree.MemberExpression
): string | undefined {
  if (!member.computed) return
  if (member.property.type !== 'TemplateLiteral') return
  if (member.property.expressions.length !== 0) return
  return member.property.quasis[0].value.cooked ?? undefined
}

function getStaticMethodName(member: TSESTree.MemberExpression) {
  return (
    getIdentifierName(member) ??
    getLiteralName(member) ??
    getTemplateName(member)
  )
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
