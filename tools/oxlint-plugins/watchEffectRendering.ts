const WATCH_EFFECT_IMPORTS = new Set(['watchEffect'])
const RENDER_METHODS = new Set(['draw', 'setDirty'])

interface Node {
  readonly type: string
}

interface Identifier extends Node {
  readonly type: 'Identifier'
  readonly name: string
}

interface StringLiteral extends Node {
  readonly value: string
}

interface MemberExpression extends Node {
  readonly type: 'MemberExpression'
  readonly property: Expression
  readonly computed: boolean
}

interface ChainExpression extends Node {
  readonly type: 'ChainExpression'
  readonly expression: Expression
}

type Expression = Node | Identifier | StringLiteral | MemberExpression

interface CallExpression extends Node {
  readonly type: 'CallExpression'
  readonly callee: Expression | ChainExpression
  readonly arguments: readonly Expression[]
}

interface ScopeVariableDefinition {
  readonly type: string
  readonly node: Node & { readonly imported?: Identifier }
  readonly parent: Node & { readonly source?: StringLiteral }
}

interface ScopeVariable {
  readonly defs: readonly ScopeVariableDefinition[]
}

interface ScopeReference {
  readonly identifier: Identifier
  readonly resolved?: ScopeVariable
}

interface Scope {
  readonly references: readonly ScopeReference[]
  readonly upper?: Scope
}

interface RuleContext {
  readonly sourceCode: {
    getAncestors(node: Node): readonly Node[]
    getScope(node: Node): Scope
  }
  report(descriptor: { node: Node; message: string }): void
}

function unwrapChain(expression: Expression | ChainExpression): Expression {
  return expression.type === 'ChainExpression'
    ? (expression as ChainExpression).expression
    : expression
}

function asIdentifier(
  expression: Expression | ChainExpression
): Identifier | undefined {
  const unwrapped = unwrapChain(expression)
  return unwrapped.type === 'Identifier' ? (unwrapped as Identifier) : undefined
}

function asMemberExpression(
  expression: Expression | ChainExpression
): MemberExpression | undefined {
  const unwrapped = unwrapChain(expression)
  return unwrapped.type === 'MemberExpression'
    ? (unwrapped as MemberExpression)
    : undefined
}

function staticMemberName(member: MemberExpression): string | undefined {
  const property = unwrapChain(member.property)
  if (!member.computed && property.type === 'Identifier') {
    return (property as Identifier).name
  }
  if (
    member.computed &&
    typeof (property as StringLiteral).value === 'string'
  ) {
    return (property as StringLiteral).value
  }
}

function resolvedVariable(
  context: RuleContext,
  identifier: Identifier
): ScopeVariable | undefined {
  let scope: Scope | undefined = context.sourceCode.getScope(identifier)
  while (scope) {
    const reference = scope.references.find(
      (candidate) => candidate.identifier === identifier
    )
    if (reference) return reference.resolved
    scope = scope.upper
  }
}

function isVueWatchEffect(
  context: RuleContext,
  expression: Expression | ChainExpression
): boolean {
  const identifier = asIdentifier(expression)
  if (!identifier) return false
  const variable = resolvedVariable(context, identifier)
  return (
    variable?.defs.some(
      (definition) =>
        definition.type === 'ImportBinding' &&
        definition.parent.source?.value === 'vue' &&
        definition.node.imported?.name !== undefined &&
        WATCH_EFFECT_IMPORTS.has(definition.node.imported.name)
    ) === true
  )
}

function isFunction(node: Node): boolean {
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression' ||
    node.type === 'FunctionDeclaration'
  )
}

function runsDirectlyInWatchEffect(
  context: RuleContext,
  node: CallExpression
): boolean {
  const ancestors = context.sourceCode.getAncestors(node)
  const callbackIndex = ancestors.findLastIndex(isFunction)
  if (callbackIndex < 0) return false

  const callback = ancestors[callbackIndex]
  const parent = ancestors[callbackIndex - 1]
  if (parent?.type !== 'CallExpression') return false

  const call = parent as CallExpression
  return (
    call.arguments.includes(callback as Expression) &&
    isVueWatchEffect(context, call.callee)
  )
}

export const noRenderInWatchEffect = {
  create(context: RuleContext) {
    return {
      CallExpression(node: CallExpression) {
        const member = asMemberExpression(node.callee)
        if (!member) return
        const methodName = staticMemberName(member)
        if (
          !methodName ||
          !RENDER_METHODS.has(methodName) ||
          !runsDirectlyInWatchEffect(context, node)
        ) {
          return
        }

        context.report({
          node,
          message: `Do not call .${methodName}() inside watchEffect(): rendering can read reactive state and silently become a dependency, creating redraw feedback loops. Use watch() with explicit sources instead.`
        })
      }
    }
  }
}
