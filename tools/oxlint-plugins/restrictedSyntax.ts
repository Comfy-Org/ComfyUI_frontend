interface Node {
  readonly type: string
}

interface Identifier extends Node {
  readonly type: 'Identifier'
  readonly name: string
}

interface TypeReference extends Node {
  readonly type: 'TSTypeReference'
  readonly typeName: Node
}

interface RuleContext {
  readonly sourceCode: {
    getAncestors(node: Node): readonly Node[]
  }
  report(descriptor: { node: Node; message: string }): void
}

const ERROR_ASSERTION_MESSAGE =
  'Do not use Error type assertions. Use `instanceof Error` narrowing or `toError()` from @/utils/errorUtil instead. See issue #11429.'

export const noUnsafeErrorAssertion = {
  create(context: RuleContext) {
    return {
      TSTypeReference(node: TypeReference) {
        if (
          node.typeName.type !== 'Identifier' ||
          (node.typeName as Identifier).name !== 'Error' ||
          !context.sourceCode
            .getAncestors(node)
            .some(
              (ancestor) =>
                ancestor.type === 'TSAsExpression' ||
                ancestor.type === 'TSTypeAssertion'
            )
        ) {
          return
        }
        context.report({ node, message: ERROR_ASSERTION_MESSAGE })
      }
    }
  }
}
