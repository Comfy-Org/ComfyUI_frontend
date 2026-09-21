import { ESLintUtils } from '@typescript-eslint/utils'
import type { TSESTree } from '@typescript-eslint/utils'
import type ts from 'typescript'

const es2023ArrayCopyMethods = new Set([
  'toReversed',
  'toSorted',
  'toSpliced',
  'with'
])

function isArrayType(checker: ts.TypeChecker, type: ts.Type): boolean {
  const nonNullableType = checker.getNonNullableType(type)
  if (nonNullableType !== type) {
    return isArrayType(checker, nonNullableType)
  }

  const constraint = checker.getBaseConstraintOfType(type)
  if (constraint && constraint !== type) {
    return isArrayType(checker, constraint)
  }

  if (type.isUnion()) {
    return type.types.every((member) => isArrayType(checker, member))
  }

  if (type.isIntersection()) {
    return type.types.some((member) => isArrayType(checker, member))
  }

  return checker.isArrayType(type) || checker.isTupleType(type)
}

function getMethodName(member: TSESTree.MemberExpression): string | undefined {
  if (!member.computed && member.property.type === 'Identifier') {
    return member.property.name
  }

  if (
    member.computed &&
    member.property.type === 'Literal' &&
    typeof member.property.value === 'string'
  ) {
    return member.property.value
  }

  if (
    member.computed &&
    member.property.type === 'TemplateLiteral' &&
    member.property.expressions.length === 0
  ) {
    return member.property.quasis[0]?.value.cooked ?? undefined
  }
}

export const noEs2023ArrayCopyMethod = ESLintUtils.RuleCreator.withoutDocs({
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
      const methodName = getMethodName(node.callee)
      if (!methodName || !es2023ArrayCopyMethods.has(methodName)) return
      const receiver = services.esTreeNodeToTSNodeMap.get(node.callee.object)
      if (!isArrayType(checker, checker.getTypeAtLocation(receiver))) return
      context.report({ node, messageId: 'unsupported' })
    }

    return {
      CallExpression: reportArrayCopyMethod
    }
  }
})
