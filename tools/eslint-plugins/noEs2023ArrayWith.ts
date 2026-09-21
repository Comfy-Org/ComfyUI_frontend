import type { Rule } from 'eslint'
import type ts from 'typescript'

interface TypeScriptParserServices {
  esTreeNodeToTSNodeMap: ReadonlyMap<unknown, ts.Node>
  program: ts.Program
}

function isArrayType(checker: ts.TypeChecker, type: ts.Type): boolean {
  if (type.isUnion()) {
    return type.types.every((member) => isArrayType(checker, member))
  }

  return checker.isArrayType(type) || checker.isTupleType(type)
}

export const noEs2023ArrayWith: Rule.RuleModule = {
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
      .parserServices as TypeScriptParserServices
    const checker = services.program.getTypeChecker()

    function reportArrayWith(node: Rule.Node) {
      const call = node as Rule.Node & { callee: { object: unknown } }
      const receiver = services.esTreeNodeToTSNodeMap.get(call.callee.object)
      if (!receiver) return
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
}
