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

const GLOBALLY_SPIED_CONSOLE_METHODS = new Set([
  'debug',
  'error',
  'info',
  'log',
  'warn'
])
const CONSOLE_GLOBAL = new Set(['console'])
const CONSOLE_OWNERS = new Set(['globalThis', 'window'])
const FETCH_GLOBAL = new Set(['fetch'])
const FETCH_OWNERS = new Set(['global', 'globalThis', 'window'])

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

interface AssignmentExpression extends Node {
  readonly type: 'AssignmentExpression'
  readonly left: Expression
}

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
    readonly imported?: Identifier
    readonly init?: Expression
  }
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

interface RuleFixer {
  replaceText(node: Node, text: string): unknown
}

interface RuleContext {
  readonly sourceCode: {
    getAncestors(node: Node): readonly Node[]
    getScope(node: Node): Scope
    getText(node: Node): string
  }
  report(descriptor: {
    node: Node
    message: string
    fix?: (fixer: RuleFixer) => unknown
  }): void
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

function continuesReceiverChain(parent: Node, child: Node): boolean {
  return (
    parent.type === 'ChainExpression' ||
    (parent.type === 'CallExpression' &&
      (parent as CallExpression).callee === child) ||
    (parent.type === 'MemberExpression' &&
      (parent as MemberExpression).object === child)
  )
}

function headsExpression(
  ancestors: readonly Node[],
  rootIndex: number,
  node: CallExpression
): boolean {
  return ancestors
    .slice(rootIndex + 1)
    .every((parent, offset, chain) =>
      continuesReceiverChain(parent, chain.at(offset + 1) ?? node)
    )
}

function leadsHookBody(
  ancestors: readonly Node[],
  boundaryIndex: number,
  node: CallExpression
) {
  const body = ancestors.at(boundaryIndex + 1)
  if (body?.type !== 'BlockStatement') {
    return headsExpression(ancestors, boundaryIndex, node)
  }
  const statement = ancestors.at(boundaryIndex + 2)
  if (
    statement?.type !== 'ExpressionStatement' ||
    !headsExpression(ancestors, boundaryIndex + 2, node)
  ) {
    return false
  }
  const statements = (body as BlockStatement).body
  return statements
    .slice(0, statements.indexOf(statement))
    .every(isMockInstanceCleanup)
}

function isBeforeEachStatement(context: RuleContext, statement: Node) {
  return (
    statement.type === 'ExpressionStatement' &&
    isVitestCallbackCall(
      context,
      unwrapChain((statement as ExpressionStatement).expression),
      BEFORE_EACH_IMPORTS
    )
  )
}

function runsFirstAmongBeforeEachHooks(
  context: RuleContext,
  hookAncestors: readonly Node[]
): boolean {
  let innermost = true
  for (let index = hookAncestors.length - 2; index >= 0; index--) {
    const scope = hookAncestors[index]
    if (scope.type !== 'Program' && scope.type !== 'BlockStatement') continue
    const statements = (scope as BlockStatement).body
    const ownStatement = hookAncestors[index + 1]
    const earlierHooks = innermost
      ? statements.slice(0, statements.indexOf(ownStatement))
      : statements.filter((statement) => statement !== ownStatement)
    if (
      earlierHooks.some((statement) =>
        isBeforeEachStatement(context, statement)
      )
    ) {
      return false
    }
    innermost = false
  }
  return true
}

function precedesBeforeEachSetup(
  context: RuleContext,
  node: CallExpression
): boolean {
  const ancestors = context.sourceCode.getAncestors(node)
  const boundaryIndex = enclosingExecutionBoundaryIndex(ancestors)
  return (
    leadsHookBody(ancestors, boundaryIndex, node) &&
    runsFirstAmongBeforeEachHooks(
      context,
      ancestors.slice(0, boundaryIndex - 1)
    )
  )
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
    return {
      CallExpression(node: CallExpression) {
        const mockMethodName = calledMemberName(node)
        if (
          mockMethodName &&
          REDUNDANT_MOCK_INSTANCE_CLEANUP_METHODS.has(mockMethodName) &&
          isRedundantMockInstanceCleanup(context, node)
        ) {
          context.report({
            node,
            message: `.${mockMethodName}() is redundant in a Vitest hook because the project test setup resets and restores every mock before each test.`
          })
          return
        }

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

function isGlobalIdentifier(
  context: RuleContext,
  expression: Expression,
  names: ReadonlySet<string>
): boolean {
  const identifier = asIdentifier(expression)
  return (
    identifier !== undefined &&
    names.has(identifier.name) &&
    !resolvedVariable(context, identifier)?.defs.length
  )
}

function isGlobalConsole(context: RuleContext, expression: Expression) {
  if (isGlobalIdentifier(context, expression, CONSOLE_GLOBAL)) {
    return true
  }
  const member = asMemberExpression(expression)
  return (
    member !== undefined &&
    staticMemberName(member) === 'console' &&
    isGlobalIdentifier(context, member.object, CONSOLE_OWNERS)
  )
}

export const noRedundantConsoleSpy = {
  create(context: RuleContext) {
    return {
      CallExpression(node: CallExpression) {
        if (
          vitestMethodName(context, node) !== 'spyOn' ||
          node.arguments.length < 2
        ) {
          return
        }
        const [target, method] = node.arguments
        const methodName = staticModuleName(method)
        if (
          !methodName ||
          !GLOBALLY_SPIED_CONSOLE_METHODS.has(methodName) ||
          !isGlobalConsole(context, target)
        ) {
          return
        }
        context.report({
          node,
          message: `console.${methodName} is already spied before every test by vitest.console.setup.ts, and output from passing tests is silenced. Assert with expect(console.${methodName}) and replace its implementation with vi.mocked(console.${methodName}).`
        })
      }
    }
  }
}

const FETCH_STUB_MESSAGE =
  'fetch is already a mock from vitest.network.setup.ts that blocks real requests by default, and the automatic reset restores that guard. Configure it with vi.mocked(fetch) instead.'

function isGlobalFetch(context: RuleContext, expression: Expression) {
  if (isGlobalIdentifier(context, expression, FETCH_GLOBAL)) return true
  const member = asMemberExpression(expression)
  return (
    member !== undefined &&
    staticMemberName(member) === 'fetch' &&
    isGlobalIdentifier(context, member.object, FETCH_OWNERS)
  )
}

export const noRedundantFetchStub = {
  create(context: RuleContext) {
    return {
      AssignmentExpression(node: AssignmentExpression) {
        if (isGlobalFetch(context, node.left)) {
          context.report({ node, message: FETCH_STUB_MESSAGE })
        }
      },
      CallExpression(node: CallExpression) {
        const methodName = vitestMethodName(context, node)
        if (node.arguments.length < 2) return
        const [target, property] = node.arguments
        const stubsFetch =
          methodName === 'stubGlobal' && staticModuleName(target) === 'fetch'
        const spiesOnFetch =
          methodName === 'spyOn' &&
          isGlobalIdentifier(context, target, FETCH_OWNERS) &&
          staticModuleName(property) === 'fetch'
        if (stubsFetch || spiesOnFetch) {
          context.report({ node, message: FETCH_STUB_MESSAGE })
        }
      }
    }
  }
}

interface ObjectPattern extends Node {
  readonly type: 'ObjectPattern'
  readonly properties: readonly (Node & { readonly key?: Expression })[]
}

function destructuresExpect(param: Node): boolean {
  return (
    param.type === 'ObjectPattern' &&
    (param as ObjectPattern).properties.some(
      ({ key }) => key !== undefined && asIdentifier(key)?.name === 'expect'
    )
  )
}

function isVitestExpect(context: RuleContext, identifier: Identifier) {
  const variable = resolvedVariable(context, identifier)
  if (!variable?.defs.length) return true
  return variable.defs.some(
    (definition) =>
      (definition.type === 'ImportBinding' &&
        definition.parent.source?.value === 'vitest') ||
      (definition.type === 'Parameter' &&
        isFunctionExpression(definition.node) &&
        definition.node.params.some(destructuresExpect))
  )
}

function isExpectCall(context: RuleContext, call: CallExpression): boolean {
  const callee = unwrapChain(call.callee)
  const member = asMemberExpression(callee)
  const target =
    member && staticMemberName(member) === 'soft' ? member.object : callee
  const identifier = asIdentifier(target)
  return identifier?.name === 'expect' && isVitestExpect(context, identifier)
}

const PARENTHESIS_FREE_SUBJECTS = new Set([
  'CallExpression',
  'Identifier',
  'MemberExpression',
  'TSNonNullExpression'
])

function mockedRootOfSubject(
  context: RuleContext,
  subject: Expression
): CallExpression | undefined {
  let current = unwrapChain(subject)
  while (
    current.type === 'MemberExpression' ||
    current.type === 'TSNonNullExpression'
  ) {
    if (current.type === 'MemberExpression') {
      const member = current as MemberExpression
      if (staticMemberName(member) === 'mock') return
      current = unwrapChain(member.object)
    } else {
      current = unwrapChain(
        (current as Node & { expression: Expression }).expression
      )
    }
  }
  if (current.type !== 'CallExpression') return
  const call = current as CallExpression
  return vitestMethodName(context, call) === 'mocked' &&
    call.arguments.length > 0
    ? call
    : undefined
}

export const noMockedInExpect = {
  meta: { fixable: 'code' },
  create(context: RuleContext) {
    return {
      CallExpression(node: CallExpression) {
        if (node.arguments.length === 0 || !isExpectCall(context, node)) return
        const mocked = mockedRootOfSubject(context, node.arguments[0])
        if (!mocked) return
        const [mockedValue] = mocked.arguments
        const valueText = context.sourceCode.getText(mockedValue)
        const needsParentheses =
          mockedValue.type === 'SequenceExpression' ||
          (mocked !== unwrapChain(node.arguments[0]) &&
            !PARENTHESIS_FREE_SUBJECTS.has(mockedValue.type))
        const replacement = needsParentheses ? `(${valueText})` : valueText
        context.report({
          node: mocked,
          message:
            'vi.mocked() only changes the type, and expect() accepts the function directly. Pass the function to expect() without vi.mocked().',
          fix: (fixer) => fixer.replaceText(mocked, replacement)
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
