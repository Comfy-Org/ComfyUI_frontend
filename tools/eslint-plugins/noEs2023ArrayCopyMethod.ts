import { ESLintUtils } from '@typescript-eslint/utils'
import type { TSESTree } from '@typescript-eslint/utils'
import type { Rule } from 'eslint'
import type ts from 'typescript'

const es2023ArrayCopyMethods = new Set([
  'toReversed',
  'toSorted',
  'toSpliced',
  'with'
])

function isDirectArrayType(checker: ts.TypeChecker, type: ts.Type): boolean {
  return checker.isArrayType(type) || checker.isTupleType(type)
}

function isCompositeArrayType(checker: ts.TypeChecker, type: ts.Type): boolean {
  if (type.isUnion()) {
    return type.types.every((member) => isArrayType(checker, member))
  }
  if (type.isIntersection()) {
    return type.types.some((member) => isArrayType(checker, member))
  }
  return false
}

function isArrayType(checker: ts.TypeChecker, type: ts.Type): boolean {
  const nonNullableType = checker.getNonNullableType(type)
  const resolvedType =
    checker.getBaseConstraintOfType(nonNullableType) ?? nonNullableType
  return (
    isDirectArrayType(checker, resolvedType) ||
    isCompositeArrayType(checker, resolvedType)
  )
}

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
  return normalizeCooked(member.property.quasis[0].value.cooked)
}

function normalizeCooked(cooked: string | null): string | undefined {
  return cooked ?? undefined
}

function getMethodName(member: TSESTree.MemberExpression) {
  return (
    getIdentifierName(member) ??
    getLiteralName(member) ??
    getTemplateName(member)
  )
}

function isArrayCopyMethod(methodName: string | undefined): boolean {
  return methodName !== undefined && es2023ArrayCopyMethods.has(methodName)
}

const typedRule = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      unsupported:
        'ES2023 array method is not polyfilled for build target es2022; use the matching ES2022-safe non-mutating equivalent.'
    },
    defaultOptions: []
  },
  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const checker = services.program.getTypeChecker()

    function reportArrayCopyMethod(node: TSESTree.CallExpression) {
      if (node.callee.type !== 'MemberExpression') return
      if (!isArrayCopyMethod(getMethodName(node.callee))) return
      const receiver = services.esTreeNodeToTSNodeMap.get(node.callee.object)
      if (!isArrayType(checker, checker.getTypeAtLocation(receiver))) return
      context.report({ node, messageId: 'unsupported' })
    }

    return {
      CallExpression: reportArrayCopyMethod
    }
  }
})

// ESLint 10 and @typescript-eslint/utils expose structurally incompatible
// RuleModule context types even though ESLint accepts this rule at runtime.
export const noEs2023ArrayCopyMethod = typedRule as unknown as Rule.RuleModule
