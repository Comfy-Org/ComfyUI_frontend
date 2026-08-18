export interface Node {
  readonly type: string
  readonly name?: string
  readonly callee?: Node
  readonly property?: Node
}

export interface CallExpression extends Node {
  readonly type: 'CallExpression'
  readonly callee: Node
}

export interface TypeReference extends Node {
  readonly type: 'TSTypeReference'
  readonly typeName: Node
}

export interface ImportDeclaration extends Node {
  readonly type: 'ImportDeclaration'
  readonly source: { readonly value: string }
}

export interface RuleContext {
  readonly sourceCode: {
    getAncestors(node: Node): readonly Node[]
  }
  report(descriptor: { node: Node; message: string }): void
}
