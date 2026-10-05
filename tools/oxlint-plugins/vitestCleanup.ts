const REDUNDANT_CLEANUP_METHODS = new Set([
  'clearAllMocks',
  'resetAllMocks',
  'restoreAllMocks',
  'unstubAllEnvs',
  'unstubAllGlobals'
])
const REDUNDANT_MOCK_INSTANCE_CLEANUP_METHODS = new Set([
  'mockClear',
  'mockReset',
  'mockRestore'
])
const REDUNDANT_TIMER_CLEANUP_METHODS = new Set([
  'clearAllTimers',
  'useRealTimers'
])
const REDUNDANT_LITEGRAPH_CLEANUP_METHODS = new Set([
  'clearRegisteredTypes',
  'unregisterNodeType'
])

const MOCK_FACTORY_METHODS = new Set(['fn', 'mocked', 'spyOn'])
const TYPE_WRAPPERS = new Set([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression'
])
const MODULE_SCOPE_MOCK_METHODS = new Set(['spyOn', 'stubGlobal'])
const PARTIAL_MOCK_METHODS = new Set(['doMock', 'mock'])
const AFTER_EACH_IMPORTS = new Set(['afterEach'])
const BEFORE_EACH_IMPORTS = new Set(['beforeEach'])
const NON_BEFORE_EACH_HOOKS = new Set(['afterAll', 'afterEach', 'beforeAll'])
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

interface TemplateLiteral extends Node {
  readonly type: 'TemplateLiteral'
  readonly expressions: readonly Expression[]
  readonly quasis: readonly {
    readonly value: { readonly cooked?: string; readonly raw: string }
  }[]
}

interface ImportExpression extends Node {
  readonly type: 'ImportExpression'
  readonly source: Expression
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
  | TemplateLiteral
  | MemberExpression
  | ChainExpression

interface CallExpression extends Node {
  readonly type: 'CallExpression'
  readonly callee: Expression
  readonly arguments: readonly Expression[]
}

interface FunctionExpression extends Node {
  readonly type:
    | 'ArrowFunctionExpression'
    | 'FunctionDeclaration'
    | 'FunctionExpression'
  readonly params: readonly Node[]
  readonly body: Node
}

interface Property extends Node {
  readonly type: 'Property'
  readonly key: Expression
  readonly value: Expression
  readonly computed: boolean
}

interface ObjectExpression extends Node {
  readonly type: 'ObjectExpression'
  readonly properties: readonly Node[]
}

interface ObjectPattern extends Node {
  readonly type: 'ObjectPattern'
  readonly properties: readonly Node[]
}

interface ReturnStatement extends Node {
  readonly type: 'ReturnStatement'
  readonly argument: Expression | null
}

interface AwaitExpression extends Node {
  readonly type: 'AwaitExpression'
  readonly argument: Expression
}

interface WrappedExpression extends Node {
  readonly expression: Expression
}

interface Program extends Node {
  readonly body: readonly Node[]
}

interface ExpressionStatement extends Node {
  readonly type: 'ExpressionStatement'
  readonly expression: Expression
}

interface BlockStatement extends Node {
  readonly type: 'BlockStatement'
  readonly body: readonly Node[]
}

function isImportExpression(node: Node | undefined): node is ImportExpression {
  return node?.type === 'ImportExpression'
}

function isTemplateLiteral(node: Node): node is TemplateLiteral {
  return node.type === 'TemplateLiteral'
}

function staticModuleName(node: Node | undefined): string | undefined {
  if (!node) return
  if (isImportExpression(node)) return staticModuleName(node.source)
  if ('value' in node && typeof node.value === 'string') return node.value
  if (isTemplateLiteral(node)) {
    if (node.expressions.length === 0) {
      return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw
    }
  }
}

function isFunctionExpression(
  node: Node | undefined
): node is FunctionExpression {
  return (
    node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionDeclaration' ||
    node?.type === 'FunctionExpression'
  )
}

interface ScopeVariableDefinition {
  readonly type: string
  readonly node: Node & {
    readonly id?: Node
    readonly imported?: Identifier
    readonly init?: Expression
  }
  readonly parent: Node & { readonly source?: StringLiteral }
}

interface ScopeVariable {
  readonly defs: readonly ScopeVariableDefinition[]
  readonly references: readonly { readonly writeExpr: Expression | null }[]
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

function mockFactory(
  context: RuleContext,
  expression: Expression | undefined
): FunctionExpression | undefined {
  if (isFunctionExpression(expression)) return expression
  const identifier = expression && asIdentifier(expression)
  if (!identifier) return

  const variable = resolvedVariable(context, identifier)
  const definition = variable?.defs.find(
    ({ node }) =>
      isFunctionExpression(node) ||
      (node.type === 'VariableDeclarator' && isFunctionExpression(node.init))
  )?.node
  if (isFunctionExpression(definition)) return definition
  if (
    definition?.type === 'VariableDeclarator' &&
    isFunctionExpression(definition.init)
  ) {
    return definition.init
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

function calledMemberName(node: Node | undefined): string | undefined {
  if (node?.type !== 'CallExpression') return
  const member = asMemberExpression((node as CallExpression).callee)
  return member && staticMemberName(member)
}

function isMockInstanceCleanup(statement: Node): boolean {
  if (statement.type !== 'ExpressionStatement') return false
  const methodName = calledMemberName(
    unwrapChain((statement as ExpressionStatement).expression)
  )
  return (
    methodName !== undefined &&
    REDUNDANT_MOCK_INSTANCE_CLEANUP_METHODS.has(methodName)
  )
}

function precedesBeforeEachSetup(
  context: RuleContext,
  node: CallExpression
): boolean {
  const ancestors = context.sourceCode.getAncestors(node)
  const boundaryIndex = enclosingExecutionBoundaryIndex(ancestors)
  const body = ancestors.at(boundaryIndex + 1)
  if (body?.type !== 'BlockStatement') return true
  const statements = (body as BlockStatement).body
  const statementIndex = statements.findIndex(
    (statement) => statement === ancestors[boundaryIndex + 2]
  )
  return statements.slice(0, statementIndex).every(isMockInstanceCleanup)
}

function unwrapExpression(expression: Expression): Expression {
  let current = unwrapChain(expression)
  while (
    TYPE_WRAPPERS.has(current.type) ||
    current.type === 'AwaitExpression'
  ) {
    current = unwrapChain(
      current.type === 'AwaitExpression'
        ? (current as AwaitExpression).argument
        : (current as WrappedExpression).expression
    )
  }
  return current
}

function staticPropertyName(property: Property): string | undefined {
  if (!property.computed && property.key.type === 'Identifier') {
    return (property.key as Identifier).name
  }
  const value = (property.key as StringLiteral).value
  if (typeof value === 'string') return value
}

function propertyValue(
  object: Expression,
  name: string
): Expression | undefined {
  if (object.type !== 'ObjectExpression') return
  return (object as ObjectExpression).properties.find(
    (property): property is Property =>
      property.type === 'Property' &&
      staticPropertyName(property as Property) === name
  )?.value
}

function hoistedValue(
  context: RuleContext,
  call: CallExpression
): Expression | undefined {
  const factory = call.arguments[0]
  if (
    vitestMethodName(context, call) !== 'hoisted' ||
    !isFunctionExpression(factory)
  ) {
    return
  }
  if (factory.body.type !== 'BlockStatement') return factory.body
  const returned = (factory.body as BlockStatement).body.find(
    (statement) => statement.type === 'ReturnStatement'
  ) as ReturnStatement | undefined
  return returned?.argument ?? undefined
}

const MAX_RESOLUTION_DEPTH = 8

function destructuredValues(
  context: RuleContext,
  definition: ScopeVariableDefinition,
  name: string,
  depth: number
): Expression[] {
  const { id, init } = definition.node
  if (id?.type !== 'ObjectPattern' || !init) return []
  const key = (id as ObjectPattern).properties
    .filter((property): property is Property => property.type === 'Property')
    .find(
      (property) => asIdentifier(unwrapChain(property.value))?.name === name
    )
  const keyName = key && staticPropertyName(key)
  if (!keyName) return []
  return resolveValues(context, init, depth + 1).flatMap((object) => {
    const value = propertyValue(object, keyName)
    return value ? resolveValues(context, value, depth + 1) : []
  })
}

function resolveValues(
  context: RuleContext,
  expression: Expression,
  depth = 0
): Expression[] {
  const value = unwrapExpression(expression)
  if (depth > MAX_RESOLUTION_DEPTH) return [value]

  if (value.type === 'Identifier') {
    return identifierValues(context, value as Identifier, depth)
  }
  if (value.type === 'CallExpression') {
    const hoisted = hoistedValue(context, value as CallExpression)
    return hoisted ? resolveValues(context, hoisted, depth + 1) : [value]
  }
  const member = asMemberExpression(value)
  return member ? memberValues(context, member, depth) : [value]
}

function identifierValues(
  context: RuleContext,
  identifier: Identifier,
  depth: number
): Expression[] {
  const variable = resolvedVariable(context, identifier)
  if (!variable) return [identifier]
  return [
    identifier,
    ...variable.defs.flatMap((definition) =>
      destructuredValues(context, definition, identifier.name, depth)
    ),
    ...variable.references.flatMap(({ writeExpr }) =>
      writeExpr ? resolveValues(context, writeExpr, depth + 1) : []
    )
  ]
}

function memberValues(
  context: RuleContext,
  member: MemberExpression,
  depth: number
): Expression[] {
  const name = staticMemberName(member)
  if (!name) return [member]
  const resolved = resolveValues(context, member.object, depth + 1).flatMap(
    (object) => {
      const property = propertyValue(object, name)
      return property ? resolveValues(context, property, depth + 1) : []
    }
  )
  return resolved.length > 0 ? resolved : [member]
}

function isMockedModuleImport(
  context: RuleContext,
  identifier: Identifier,
  mockedModules: ReadonlySet<string>
): boolean {
  return (
    resolvedVariable(context, identifier)?.defs.some(
      (definition) =>
        definition.type === 'ImportBinding' &&
        typeof definition.parent.source?.value === 'string' &&
        mockedModules.has(definition.parent.source.value)
    ) === true
  )
}

function isVitestMock(
  context: RuleContext,
  expression: Expression,
  mockedModules: ReadonlySet<string>,
  depth = 0
): boolean {
  if (depth > MAX_RESOLUTION_DEPTH) return false
  return resolveValues(context, expression).some((value) => {
    if (value.type === 'Identifier') {
      return isMockedModuleImport(context, value as Identifier, mockedModules)
    }
    if (value.type === 'CallExpression') {
      const call = value as CallExpression
      const factory = vitestMethodName(context, call)
      if (factory && MOCK_FACTORY_METHODS.has(factory)) return true
      const member = asMemberExpression(call.callee)
      return (
        member !== undefined &&
        staticMemberName(member)?.startsWith('mock') === true &&
        isVitestMock(context, member.object, mockedModules, depth + 1)
      )
    }
    const member = asMemberExpression(value)
    return (
      member !== undefined &&
      resolveValues(context, member.object).some(
        (object) =>
          object.type === 'CallExpression' &&
          vitestMethodName(context, object as CallExpression) === 'mocked'
      )
    )
  })
}

function vitestMockedModules(
  context: RuleContext,
  program: Program
): Set<string> {
  return new Set(
    program.body.flatMap((statement) => {
      if (statement.type !== 'ExpressionStatement') return []
      const call = unwrapChain((statement as ExpressionStatement).expression)
      if (
        call.type !== 'CallExpression' ||
        vitestMethodName(context, call as CallExpression) !== 'mock'
      ) {
        return []
      }
      const moduleName = staticModuleName((call as CallExpression).arguments[0])
      return moduleName ? [moduleName] : []
    })
  )
}

function redundantMockInstanceCleanupName(
  context: RuleContext,
  node: CallExpression,
  mockedModules: ReadonlySet<string>
): string | undefined {
  const member = asMemberExpression(node.callee)
  const methodName = member && staticMemberName(member)
  if (
    methodName &&
    REDUNDANT_MOCK_INSTANCE_CLEANUP_METHODS.has(methodName) &&
    isRedundantMockInstanceCleanup(context, node) &&
    isVitestMock(context, member.object, mockedModules)
  ) {
    return methodName
  }
}

function redundantVitestCleanupName(
  context: RuleContext,
  node: CallExpression
): string | undefined {
  const methodName = vitestMethodName(context, node)
  if (!methodName) return
  if (
    (REDUNDANT_CLEANUP_METHODS.has(methodName) &&
      runsDirectlyInVitestCallback(context, node)) ||
    (REDUNDANT_TIMER_CLEANUP_METHODS.has(methodName) &&
      runsDirectlyInVitestCallback(context, node, AFTER_EACH_IMPORTS))
  ) {
    return methodName
  }
}

function isRedundantMockInstanceCleanup(
  context: RuleContext,
  node: CallExpression
): boolean {
  return (
    runsDirectlyInVitestCallback(context, node, NON_BEFORE_EACH_HOOKS) ||
    (runsDirectlyInVitestCallback(context, node, BEFORE_EACH_IMPORTS) &&
      precedesBeforeEachSetup(context, node))
  )
}

export const noRedundantVitestCleanup = {
  create(context: RuleContext) {
    let mockedModules = new Set<string>()
    return {
      Program(program: Program) {
        mockedModules = vitestMockedModules(context, program)
      },
      CallExpression(node: CallExpression) {
        const mockMethodName = redundantMockInstanceCleanupName(
          context,
          node,
          mockedModules
        )
        if (mockMethodName) {
          context.report({
            node,
            message: `.${mockMethodName}() is redundant in a Vitest hook because the project test setup resets and restores every mock before each test.`
          })
          return
        }

        const methodName = redundantVitestCleanupName(context, node)
        if (!methodName) return
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

export const noImportActual = {
  create(context: RuleContext) {
    const mockedModulesByFactory = new Map<FunctionExpression, Set<string>>()
    const importsInFactories: {
      node: ImportExpression
      factory: FunctionExpression
      importedModule: string
    }[] = []

    return {
      CallExpression(node: CallExpression) {
        const methodName = vitestMethodName(context, node)
        const factory =
          methodName !== undefined && PARTIAL_MOCK_METHODS.has(methodName)
            ? mockFactory(context, node.arguments[1])
            : undefined
        if (factory !== undefined) {
          const mockedModule = staticModuleName(node.arguments[0])
          if (mockedModule !== undefined) {
            const modules = mockedModulesByFactory.get(factory) ?? new Set()
            modules.add(mockedModule)
            mockedModulesByFactory.set(factory, modules)
          }
        }
        const usesImportOriginal =
          factory !== undefined && factory.params.length > 0

        if (methodName !== 'importActual' && !usesImportOriginal) return

        context.report({
          node,
          message:
            'Avoid importOriginal() and vi.importActual(). Import the module normally and use vi.spyOn(), vi.mock(..., { spy: true }), or a focused full mock.'
        })
      },
      ImportExpression(node: ImportExpression) {
        const importedModule = staticModuleName(node.source)
        if (importedModule === undefined) return
        const ancestors = context.sourceCode.getAncestors(node)
        const factory = ancestors.findLast(isFunctionExpression)
        if (factory === undefined) return
        importsInFactories.push({ node, factory, importedModule })
      },
      'Program:exit'() {
        for (const { node, factory, importedModule } of importsInFactories) {
          if (!mockedModulesByFactory.get(factory)?.has(importedModule))
            continue
          context.report({
            node,
            message:
              'Do not dynamically import the original module in a vi.mock() factory. Delete the mock, use vi.mock(..., { spy: true }), or provide a focused full mock.'
          })
        }
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
