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

    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression') {
          return
        }

        const property = callee.property
        const propertyName =
          property.type === 'Identifier'
            ? property.name
            : property.type === 'Literal'
              ? property.value
              : property.type === 'TemplateLiteral' &&
                  property.expressions.length === 0
                ? property.quasis[0]?.value.cooked
                : undefined
        if (propertyName !== 'with') return

        const receiver = services.esTreeNodeToTSNodeMap.get(callee.object)
        if (
          receiver &&
          isArrayType(checker, checker.getTypeAtLocation(receiver))
        ) {
          context.report({ node, messageId: 'unsupported' })
        }
      }
    }
  }
}
