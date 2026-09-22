import type {
  ParserServicesWithTypeInformation,
  TSESTree
} from '@typescript-eslint/utils'
import type { ESLint, Rule } from 'eslint'
import type ts from 'typescript'

const es2023ArrayCopyMethods = new Set([
  'toReversed',
  'toSorted',
  'toSpliced',
  'with'
])
const es2023TypedArrayNames = new Set([
  'BigInt64Array',
  'BigUint64Array',
  'Float32Array',
  'Float64Array',
  'Int8Array',
  'Int16Array',
  'Int32Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Uint16Array',
  'Uint32Array'
])

function isDirectArrayType(checker: ts.TypeChecker, type: ts.Type): boolean {
  return (
    checker.isArrayType(type) ||
    checker.isTupleType(type) ||
    isTypedArrayType(type)
  )
}

function isTypedArrayType(type: ts.Type): boolean {
  const symbol = type.getSymbol()
  return symbol !== undefined && es2023TypedArrayNames.has(symbol.name)
}

function isCompositeArrayType(checker: ts.TypeChecker, type: ts.Type): boolean {
  if (type.isUnion()) {
    return type.types.some((member) => isArrayType(checker, member))
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
    const services = context.sourceCode
      .parserServices as unknown as ParserServicesWithTypeInformation
    const checker = services.program.getTypeChecker()

    function getComputedIdentifierName(
      member: TSESTree.MemberExpression
    ): string | undefined {
      if (!member.computed || member.property.type !== 'Identifier') return
      const property = services.esTreeNodeToTSNodeMap.get(member.property)
      const propertyType = checker.getTypeAtLocation(property)
      return propertyType.isStringLiteral() ? propertyType.value : undefined
    }

    function getMethodName(member: TSESTree.MemberExpression) {
      return getStaticMethodName(member) ?? getComputedIdentifierName(member)
    }

    function hasArrayReceiver(member: TSESTree.MemberExpression): boolean {
      const receiver = services.esTreeNodeToTSNodeMap.get(member.object)
      return isArrayType(checker, checker.getTypeAtLocation(receiver))
    }

    function reportArrayCopyMethod(node: TSESTree.CallExpression) {
      if (node.callee.type !== 'MemberExpression') return
      const member = node.callee
      if (!isArrayCopyMethod(getMethodName(member))) return
      if (!hasArrayReceiver(member)) return
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
