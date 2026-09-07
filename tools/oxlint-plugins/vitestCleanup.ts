const REDUNDANT_CLEANUP_METHODS = new Set([
  'clearAllMocks',
  'resetAllMocks',
  'restoreAllMocks',
  'unstubAllEnvs',
  'unstubAllGlobals'
])
const REDUNDANT_TIMER_CLEANUP_METHODS = new Set([
  'clearAllTimers',
  'useRealTimers'
])
const REDUNDANT_LITEGRAPH_CLEANUP_METHODS = new Set([
  'clearRegisteredTypes',
  'unregisterNodeType'
])

const MODULE_SCOPE_MOCK_METHODS = new Set(['spyOn', 'stubGlobal'])
const AFTER_EACH_IMPORTS = new Set(['afterEach'])
const BEFORE_TEST_IMPORTS = new Set(['beforeAll', 'describe', 'suite'])
const SUITE_CALLBACK_MODIFIERS = new Set([
  'concurrent',
  'only',
  'sequential',
  'shuffle',
  'skip',
  'todo'
])
const SUITE_CALLBACK_FACTORIES = new Set(['each', 'for', 'runIf', 'skipIf'])
const TEARDOWN_IMPORTS = new Set(['afterAll', 'afterEach', 'onTestFinished'])
const HOOK_IMPORTS = new Set([
  'afterAll',
  'afterEach',
  'beforeAll',
  'beforeEach'
])
const VI_IMPORTS = new Set(['vi'])
const VITEST_GLOBALS = new Set([...HOOK_IMPORTS, ...BEFORE_TEST_IMPORTS, 'vi'])

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

interface PropertyDefinition extends Node {
  readonly type: 'PropertyDefinition'
  readonly static: boolean
}

interface MemberExpression extends Node {
  readonly type: 'MemberExpression'
  readonly object: Expression
  readonly property: Expression
  readonly computed: boolean
}

interface ChainExpression extends Node {
  readonly type: 'ChainExpression'
  readonly expression: Expression
}

type Expression =
  | Node
  | Identifier
  | StringLiteral
  | MemberExpression
  | ChainExpression

interface CallExpression extends Node {
  readonly type: 'CallExpression'
  readonly callee: Expression
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

function unwrapChain(expression: Expression): Expression {
  return expression.type === 'ChainExpression'
    ? (expression as ChainExpression).expression
    : expression
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

function asMemberExpression(
  expression: Expression
): MemberExpression | undefined {
  const unwrapped = unwrapChain(expression)
  return unwrapped.type === 'MemberExpression'
    ? (unwrapped as MemberExpression)
    : undefined
}

function asIdentifier(expression: Expression): Identifier | undefined {
  const unwrapped = unwrapChain(expression)
  return unwrapped.type === 'Identifier' ? (unwrapped as Identifier) : undefined
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

function isVitestImport(
  context: RuleContext,
  expression: Expression,
  importedNames?: ReadonlySet<string>
): boolean {
  const identifier = asIdentifier(expression)
  if (!identifier) return false
  const variable = resolvedVariable(context, identifier)
  if (!variable) {
    return (
      importedNames?.has(identifier.name) === true &&
      VITEST_GLOBALS.has(identifier.name)
    )
  }
  return variable.defs.some((definition) => {
    if (
      definition.type !== 'ImportBinding' ||
      definition.parent.source?.value !== 'vitest'
    ) {
      return false
    }
    if (definition.node.type === 'ImportNamespaceSpecifier') {
      return importedNames === undefined
    }
    const importedName = definition.node.imported?.name
    return importedName !== undefined && importedNames?.has(importedName)
  })
}

function isLiteGraphSingleton(
  context: RuleContext,
  expression: Expression
): boolean {
  const identifier = asIdentifier(expression)
  if (!identifier) return false
  const variable = resolvedVariable(context, identifier)
  if (!variable) return false

  return variable.defs.some((definition) => {
    if (definition.type !== 'ImportBinding') return false
    const source = definition.parent.source?.value
    return (
      definition.node.imported?.name === 'LiteGraph' &&
      typeof source === 'string' &&
      ((source.startsWith('.') && source.endsWith('/litegraph')) ||
        /(?:^|\/)lib\/litegraph(?:\/src)?\/litegraph$/.test(source))
    )
  })
}

function isVitestNamespaceMember(
  context: RuleContext,
  expression: Expression,
  memberName: string
): boolean {
  const member = asMemberExpression(expression)
  return (
    member !== undefined &&
    staticMemberName(member) === memberName &&
    isVitestImport(context, member.object)
  )
}

function vitestMethodName(
  context: RuleContext,
  call: CallExpression
): string | undefined {
  const member = asMemberExpression(call.callee)
  if (!member) return

  const methodName = staticMemberName(member)
  if (!methodName) return
  if (isVitestImport(context, member.object, VI_IMPORTS)) return methodName
  if (isVitestNamespaceMember(context, member.object, 'vi')) {
    return methodName
  }
}

function liteGraphMethodName(
  context: RuleContext,
  call: CallExpression
): string | undefined {
  const member = asMemberExpression(call.callee)
  if (!member || !isLiteGraphSingleton(context, member.object)) return
  return staticMemberName(member)
}

function isFunction(node: Node): boolean {
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression' ||
    node.type === 'FunctionDeclaration'
  )
}

function isDeferredBoundary(node: Node): boolean {
  return (
    isFunction(node) ||
    (node.type === 'PropertyDefinition' && !(node as PropertyDefinition).static)
  )
}

function enclosingExecutionBoundaryIndex(ancestors: readonly Node[]): number {
  return ancestors.findLastIndex(isDeferredBoundary)
}

function isSuiteFactoryCallback(
  context: RuleContext,
  expression: Expression,
  callbackImports: ReadonlySet<string>
): boolean {
  const unwrapped = unwrapChain(expression)
  if (unwrapped.type !== 'CallExpression') return false

  const factory = asMemberExpression((unwrapped as CallExpression).callee)
  const factoryName = factory && staticMemberName(factory)
  return (
    factory !== undefined &&
    factoryName !== undefined &&
    SUITE_CALLBACK_FACTORIES.has(factoryName) &&
    isVitestCallback(context, factory.object, callbackImports)
  )
}

function isVitestCallback(
  context: RuleContext,
  expression: Expression,
  callbackImports: ReadonlySet<string>
): boolean {
  if (
    isVitestImport(context, expression, callbackImports) ||
    [...callbackImports].some((callback) =>
      isVitestNamespaceMember(context, expression, callback)
    )
  ) {
    return true
  }

  if (isSuiteFactoryCallback(context, expression, callbackImports)) return true

  const modifier = asMemberExpression(expression)
  const modifierName = modifier && staticMemberName(modifier)
  return (
    modifier !== undefined &&
    modifierName !== undefined &&
    SUITE_CALLBACK_MODIFIERS.has(modifierName) &&
    isVitestCallback(context, modifier.object, callbackImports)
  )
}

function isVitestCallbackCall(
  context: RuleContext,
  node: Node | undefined,
  callbackImports: ReadonlySet<string> = HOOK_IMPORTS
): node is CallExpression {
  if (node?.type !== 'CallExpression') return false
  const call = node as CallExpression
  return isVitestCallback(context, call.callee, callbackImports)
}

function runsDirectlyInVitestCallback(
  context: RuleContext,
  node: CallExpression,
  callbackImports: ReadonlySet<string> = HOOK_IMPORTS
): boolean {
  const ancestors = context.sourceCode.getAncestors(node)
  const boundaryIndex = enclosingExecutionBoundaryIndex(ancestors)
  if (boundaryIndex < 0) return false

  const callback = ancestors[boundaryIndex]
  if (!isFunction(callback)) return false
  const parent = ancestors[boundaryIndex - 1]
  return (
    isVitestCallbackCall(context, parent, callbackImports) &&
    parent.arguments.includes(callback)
  )
}

function runsAtModuleScope(
  context: RuleContext,
  node: CallExpression
): boolean {
  return (
    enclosingExecutionBoundaryIndex(context.sourceCode.getAncestors(node)) < 0
  )
}

function runsBeforeTests(context: RuleContext, node: CallExpression): boolean {
  return (
    runsAtModuleScope(context, node) ||
    runsDirectlyInVitestCallback(context, node, BEFORE_TEST_IMPORTS)
  )
}

export const noRedundantVitestCleanup = {
  create(context: RuleContext) {
    return {
      CallExpression(node: CallExpression) {
        const methodName = vitestMethodName(context, node)
        if (
          !methodName ||
          !(
            (REDUNDANT_CLEANUP_METHODS.has(methodName) &&
              runsDirectlyInVitestCallback(context, node)) ||
            (REDUNDANT_TIMER_CLEANUP_METHODS.has(methodName) &&
              runsDirectlyInVitestCallback(context, node, AFTER_EACH_IMPORTS))
          )
        ) {
          return
        }
        context.report({
          node,
          message: `vi.${methodName}() is redundant in a Vitest hook because the project test setup performs this cleanup automatically.`
        })
      }
    }
  }
}

export const noModuleScopeVitestMocks = {
  create(context: RuleContext) {
    return {
      CallExpression(node: CallExpression) {
        const methodName = vitestMethodName(context, node)
        if (
          !methodName ||
          !MODULE_SCOPE_MOCK_METHODS.has(methodName) ||
          !runsBeforeTests(context, node)
        ) {
          return
        }
        context.report({
          node,
          message: `Install vi.${methodName}() in beforeEach or a test because automatic Vitest cleanup removes earlier mock installations before assertions run.`
        })
      }
    }
  }
}

export const noPersistentLiteGraphRegistration = {
  create(context: RuleContext) {
    return {
      CallExpression(node: CallExpression) {
        if (
          liteGraphMethodName(context, node) !== 'registerNodeType' ||
          !runsBeforeTests(context, node)
        ) {
          return
        }
        context.report({
          node,
          message:
            'Register LiteGraph node types in beforeEach or a test because automatic cleanup clears the registry after every test.'
        })
      }
    }
  }
}

export const noRedundantLiteGraphCleanup = {
  create(context: RuleContext) {
    return {
      CallExpression(node: CallExpression) {
        const methodName = liteGraphMethodName(context, node)
        if (
          !methodName ||
          !REDUNDANT_LITEGRAPH_CLEANUP_METHODS.has(methodName) ||
          !runsDirectlyInVitestCallback(context, node, TEARDOWN_IMPORTS)
        ) {
          return
        }
        context.report({
          node,
          message: `LiteGraph.${methodName}() is redundant because the project test setup clears registered node types after every test.`
        })
      }
    }
  }
}
