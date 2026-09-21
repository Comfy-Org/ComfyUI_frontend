import { ESLintUtils } from '@typescript-eslint/utils'
import type { TSESTree } from '@typescript-eslint/utils'
import type ts from 'typescript'

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

export const noEs2023ArrayWith = ESLintUtils.RuleCreator.withoutDocs({
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

    function reportArrayWith(node: TSESTree.CallExpression) {
      if (node.callee.type !== 'MemberExpression') return
      const receiver = services.esTreeNodeToTSNodeMap.get(node.callee.object)
      if (!isArrayType(checker, checker.getTypeAtLocation(receiver))) return
      context.report({ node, messageId: 'unsupported' })
    }

    return {
      "CallExpression[callee.type='MemberExpression'][callee.property.name='with']":
        reportArrayWith,
      "CallExpression[callee.type='MemberExpression'][callee.computed=true][callee.property.type='Literal'][callee.property.value='with']":
        reportArrayWith,
      "CallExpression[callee.type='MemberExpression'][callee.computed=true][callee.property.type='TemplateLiteral'][callee.property.expressions.length=0]:has(TemplateElement[value.cooked='with'])":
        reportArrayWith
    }
  }
})
