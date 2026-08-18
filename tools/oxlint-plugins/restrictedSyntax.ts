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

interface ImportDeclaration extends Node {
  readonly type: 'ImportDeclaration'
  readonly source: { readonly value: string }
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

export const noNewZodForRemoteApiTypes = {
  create(context: RuleContext) {
    return {
      ImportDeclaration(node: ImportDeclaration) {
        if (node.source.value !== 'zod') return
        context.report({
          node,
          message:
            'Do not hand-write new Zod schemas for remote API types. Use generated types from packages/ingest-types (@comfyorg/ingest-types) instead. See browser_tests/README.md "Sources of truth for mock types".'
        })
      }
    }
  }
}
