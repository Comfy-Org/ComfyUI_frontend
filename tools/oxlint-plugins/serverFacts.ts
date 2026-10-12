import type { SubscriptionTier } from '@comfyorg/ingest-types'
import type { RuleTester } from 'oxlint/plugins-dev'

type Rule = Parameters<RuleTester['run']>[1]
type Create = NonNullable<Rule['create']>
type Visitor = ReturnType<Create>
type VisitedNode<K extends keyof Visitor> = Parameters<
  NonNullable<Visitor[K]>
>[0]
type Expression = VisitedNode<'LogicalExpression'>['left']
type AstNode = Expression['parent']
type Ternary = VisitedNode<'ConditionalExpression'>

const CAPABILITY_SOURCES: ReadonlySet<string> = new Set([
  'useBillingCapabilities'
])
const CAPABILITY_BINDING = /^can[A-Z]\w*$/
const CAPABILITY_FIELD = /^can_[a-z_]+$/
const PENDING_FACT_WRAPPER = 'pendingServerFact'
const LOCAL_UI_STATE: ReadonlySet<string> = new Set([
  'isLoading',
  'isPending',
  'isSubmitting',
  'isSaving',
  'isBusy',
  'isFetching',
  'isValidating',
  'isDirty',
  'isValid',
  'isInvalid',
  'isOpen',
  'isDisabled',
  'loading',
  'pending',
  'submitting',
  'saving',
  'busy',
  'inFlight',
  'operation',
  'topupOperation',
  'paymentLocked',
  'isValidAmount',
  'isReady',
  'hasResolvedCapabilities',
  'snapshotAuthoritative',
  'isHiddenOnSection'
])

const LOCAL_STATE_RECORDS: ReadonlySet<string> = new Set(['failed'])

const ROLE_VALUES: ReadonlySet<string> = new Set(['owner', 'member', 'admin'])
const isRoleValue = (literal: string) => ROLE_VALUES.has(literal)
const ROLE_FIELD = /(?:^r|R)ole$/
// A role the user is picking in a form, not one the server reports.
const CHOSEN_ROLES: ReadonlySet<string> = new Set([
  'targetRole',
  'selectedRole',
  'newRole',
  'nextRole'
])
const isRoleField = (field: string) =>
  ROLE_FIELD.test(field) && !CHOSEN_ROLES.has(field)
const SERVER_TIERS: Record<SubscriptionTier, true> = {
  FREE: true,
  STANDARD: true,
  CREATOR: true,
  PRO: true,
  FOUNDERS_EDITION: true,
  TEAM: true,
  ENTERPRISE: true
}
const isServerTier = (literal: string) => Object.hasOwn(SERVER_TIERS, literal)
const anyString = () => true

const COMPARED_FACTS: ReadonlyMap<string, (literal: string) => boolean> =
  new Map([
    ['tier', isServerTier],
    ['billingStatus', anyString],
    ['subscriptionStatus', anyString],
    ['billing_status', anyString],
    ['subscription_status', anyString]
  ])
const EQUALITY_OPERATORS: ReadonlySet<string> = new Set([
  '===',
  '!==',
  '==',
  '!='
])
const ROLE_FALLBACK_OPERATORS: ReadonlySet<string> = new Set(['??', '||'])
const SERVER_MESSAGE_NAME = /message$/i
// Text matching is reported where the receiver is a server execution or API
// error; elsewhere `message` is usually a browser or library error.
const SERVER_MESSAGE_FILE = /(?:^|\/)src\/platform\/errorCatalog\//

export const GUIDANCE =
  "Render the server fact as received. If the UI needs a fact the API does not emit, open a backend ticket and wrap the interim expression in pendingServerFact('BE-xxxx', ...). See docs/adr/API-SERVER-FACTS-0042-server-facts-are-rendered-not-derived.md"

function unwrap(node: AstNode): AstNode {
  switch (node.type) {
    case 'ChainExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return unwrap(node.expression)
    default:
      return node
  }
}

function factName(node: AstNode): string | undefined {
  const expression = unwrap(node)
  if (expression.type === 'Identifier') return expression.name
  if (expression.type !== 'MemberExpression' || expression.computed) {
    return undefined
  }
  return expression.property.name === 'value'
    ? factName(expression.object)
    : expression.property.name
}

function isLiteral(node: AstNode): boolean {
  const expression = unwrap(node)
  return (
    expression.type === 'Literal' ||
    (expression.type === 'Identifier' && expression.name === 'undefined')
  )
}

function literalTruthiness(node: AstNode): boolean | undefined {
  if (!isLiteral(node)) return undefined
  const expression = unwrap(node)
  return expression.type === 'Literal' && Boolean(expression.value)
}

function stringLiteral(node: AstNode): string | undefined {
  const expression = unwrap(node)
  return expression.type === 'Literal' && typeof expression.value === 'string'
    ? expression.value
    : undefined
}

function isNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  )
}

// Property names are not references, so a `foo.canTopUp` key must not match a
// destructured `canTopUp` binding.
function childNodes(node: AstNode): AstNode[] {
  if (node.type === 'MemberExpression' && !node.computed) return [node.object]
  if (node.type === 'Property' && !node.computed) return [node.value]
  return Object.entries(node)
    .filter(([key]) => key !== 'parent')
    .flatMap(([, value]: [string, unknown]) =>
      Array.isArray(value) ? value.filter(isNode) : isNode(value) ? [value] : []
    )
}

function isPendingFactCall(node: AstNode): boolean {
  return (
    node.type === 'CallExpression' &&
    factName(node.callee) === PENDING_FACT_WRAPPER
  )
}

function isInsidePendingFact(node: AstNode): boolean {
  const { parent } = node
  return (
    parent !== null &&
    (isPendingFactCall(parent) || isInsidePendingFact(parent))
  )
}

function logicalOperands(node: AstNode): AstNode[] {
  const expression = unwrap(node)
  return expression.type === 'LogicalExpression'
    ? [
        ...logicalOperands(expression.left),
        ...logicalOperands(expression.right)
      ]
    : [expression]
}

function isCapabilitySourceCall(node: AstNode | null): boolean {
  if (!node) return false
  const expression = unwrap(node)
  return (
    expression.type === 'CallExpression' &&
    CAPABILITY_SOURCES.has(factName(expression.callee) ?? '')
  )
}

type ObjectPattern = Extract<
  VisitedNode<'VariableDeclarator'>['id'],
  { type: 'ObjectPattern' }
>

function destructuredCapabilities(pattern: ObjectPattern): string[] {
  return pattern.properties.flatMap((property) =>
    property.type === 'Property' &&
    property.key.type === 'Identifier' &&
    CAPABILITY_BINDING.test(property.key.name) &&
    property.value.type === 'Identifier'
      ? [property.value.name]
      : []
  )
}

const FUNCTION_TYPES: ReadonlySet<string> = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration'
])
const REFERENCE_TYPES: ReadonlySet<string> = new Set([
  'Identifier',
  'MemberExpression',
  'CallExpression'
])
const BOOLEAN_OPERATORS: ReadonlySet<string> = new Set([
  '!',
  '===',
  '!==',
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  'in',
  'instanceof'
])

type FunctionLike =
  | Extract<AstNode, { type: 'ArrowFunctionExpression' }>
  | Extract<AstNode, { type: 'FunctionDeclaration' | 'FunctionExpression' }>

function isFunctionLike(node: AstNode): node is FunctionLike {
  return FUNCTION_TYPES.has(node.type)
}

function returnArguments(node: AstNode): AstNode[] {
  if (node.type === 'ReturnStatement')
    return node.argument ? [node.argument] : []
  if (isFunctionLike(node)) return []
  return childNodes(node).flatMap(returnArguments)
}

function returnedValues({ body }: FunctionLike): AstNode[] {
  return body.type === 'BlockStatement' ? returnArguments(body) : [body]
}

// The values a binding holds: a getter's or function's return values, or the
// argument a ref is seeded with.
function boundValues(init: AstNode): AstNode[] {
  const expression = unwrap(init)
  if (isFunctionLike(expression)) return returnedValues(expression)
  if (expression.type !== 'CallExpression') return [expression]
  const first = expression.arguments.at(0)
  const callee = factName(expression.callee)
  if (callee === 'computed' && first && isFunctionLike(first)) {
    return returnedValues(first)
  }
  return (callee === 'ref' || callee === 'shallowRef') && first
    ? [first]
    : [expression]
}

// A value is `boolean` when its shape says so, `opaque` when it is a reference
// or a call whose type the AST cannot tell, and `other` when it is plainly not
// a boolean, such as a string, an object or a function.
type ValueKind = 'boolean' | 'opaque' | 'other'

function joinKinds(kinds: ValueKind[]): ValueKind {
  if (kinds.includes('other')) return 'other'
  return kinds.includes('boolean') ? 'boolean' : 'opaque'
}

function literalKind(value: unknown): ValueKind {
  if (typeof value === 'boolean') return 'boolean'
  return value === null ? 'opaque' : 'other'
}

function valueBranches(expression: AstNode): AstNode[] | undefined {
  if (expression.type === 'LogicalExpression') {
    return [expression.left, expression.right]
  }
  return expression.type === 'ConditionalExpression'
    ? [expression.consequent, expression.alternate]
    : undefined
}

function operatorOf(expression: AstNode): string | undefined {
  return expression.type === 'UnaryExpression' ||
    expression.type === 'BinaryExpression'
    ? expression.operator
    : undefined
}

function leafKind(expression: AstNode, isCapability: IsCapability): ValueKind {
  if (expression.type === 'Literal') return literalKind(expression.value)
  if (REFERENCE_TYPES.has(expression.type)) {
    return isCapability(expression) ? 'boolean' : 'opaque'
  }
  return BOOLEAN_OPERATORS.has(operatorOf(expression) ?? '')
    ? 'boolean'
    : 'other'
}

function valueKind(node: AstNode, isCapability: IsCapability): ValueKind {
  const expression = unwrap(node)
  const branches = valueBranches(expression)
  return branches
    ? joinKinds(branches.map((branch) => valueKind(branch, isCapability)))
    : leafKind(expression, isCapability)
}

const READ_THROUGH_CALLS: ReadonlySet<string> = new Set(['toValue', 'unref'])

function projectedField(node: AstNode): string | undefined {
  const expression = unwrap(node)
  if (expression.type === 'CallExpression') {
    const [argument] = expression.arguments
    return expression.arguments.length === 1 &&
      READ_THROUGH_CALLS.has(factName(expression.callee) ?? '')
      ? projectedField(argument)
      : undefined
  }
  return expression.type === 'MemberExpression'
    ? factName(expression)
    : undefined
}

// `const canRun = computed(() => toValue(ctx.value.canRun))` re-exposes a
// server `can*` fact under its own name, so it is that fact.
function passesFieldThrough(name: string, init: AstNode): boolean {
  const values = boundValues(init)
  return (
    CAPABILITY_BINDING.test(name) &&
    values.length > 0 &&
    values.every((value) => projectedField(value) === name)
  )
}

function referenceName(node: AstNode): string | undefined {
  const expression = unwrap(node)
  if (expression.type === 'Identifier') return expression.name
  if (
    expression.type !== 'MemberExpression' ||
    expression.computed ||
    expression.property.name !== 'value'
  ) {
    return undefined
  }
  const object = unwrap(expression.object)
  return object.type === 'Identifier' ? object.name : undefined
}

function negated(node: AstNode): AstNode | undefined {
  const expression = unwrap(node)
  return expression.type === 'UnaryExpression' && expression.operator === '!'
    ? expression.argument
    : undefined
}

function isLocalUiState(node: AstNode): boolean {
  const inner = negated(node)
  if (inner) return isLocalUiState(inner)
  const expression = unwrap(node)
  if (expression.type === 'LogicalExpression') {
    return isLocalUiState(expression.left) && isLocalUiState(expression.right)
  }
  return (
    LOCAL_UI_STATE.has(referenceName(expression) ?? '') ||
    isLocalStateRecordField(expression)
  )
}

// `failed.invites` reads one flag of a component's own load-error record.
function isLocalStateRecordField(expression: AstNode): boolean {
  if (expression.type !== 'MemberExpression' || expression.computed) {
    return false
  }
  const object = unwrap(expression.object)
  return object.type === 'Identifier' && LOCAL_STATE_RECORDS.has(object.name)
}

type IsCapability = (node: AstNode) => boolean

// Local UI state may only narrow a capability: `cap && !isLoading` is true only
// when `cap` is, and `!cap || isSubmitting` is true whenever `cap` is false.
function impliesCapability(node: AstNode, isCapability: IsCapability): boolean {
  const inner = negated(node)
  if (inner) return isDisabledWithoutCapability(inner, isCapability)
  const expression = unwrap(node)
  if (expression.type !== 'LogicalExpression') return isCapability(expression)
  return (
    expression.operator === '&&' &&
    oneSideIsLocal(expression, (side) => impliesCapability(side, isCapability))
  )
}

function isDisabledWithoutCapability(
  node: AstNode,
  isCapability: IsCapability
): boolean {
  const inner = negated(node)
  if (inner) return impliesCapability(inner, isCapability)
  const expression = unwrap(node)
  return (
    expression.type === 'LogicalExpression' &&
    expression.operator === '||' &&
    oneSideIsLocal(expression, (side) =>
      isDisabledWithoutCapability(side, isCapability)
    )
  )
}

function oneSideIsLocal(
  { left, right }: Extract<AstNode, { type: 'LogicalExpression' }>,
  narrows: (side: AstNode) => boolean
): boolean {
  return (
    (narrows(left) && isLocalUiState(right)) ||
    (isLocalUiState(left) && narrows(right))
  )
}

function memberPath(node: AstNode): string | undefined {
  const expression = unwrap(node)
  if (expression.type === 'Identifier') return expression.name
  if (expression.type !== 'MemberExpression' || expression.computed) {
    return undefined
  }
  const object = memberPath(expression.object)
  return object === undefined
    ? undefined
    : `${object}.${expression.property.name}`
}

interface LiteralDefault {
  truthy: boolean
  other: AstNode
  isConsequent: boolean
}

function literalDefault({
  consequent,
  alternate
}: Ternary): LiteralDefault | undefined {
  const consequentTruthy = literalTruthiness(consequent)
  if (consequentTruthy !== undefined) {
    return { truthy: consequentTruthy, other: alternate, isConsequent: true }
  }
  const alternateTruthy = literalTruthiness(alternate)
  return alternateTruthy === undefined
    ? undefined
    : { truthy: alternateTruthy, other: consequent, isConsequent: false }
}

// `isLoading ? false : cap` reads as `!isLoading && cap`, and
// `isSubmitting ? true : !cap` as `isSubmitting || !cap`.
function isNarrowedTernary(node: Ternary, isCapability: IsCapability): boolean {
  const fallback = literalDefault(node)
  if (!fallback || !isLocalUiState(node.test)) return false
  return fallback.truthy
    ? isDisabledWithoutCapability(fallback.other, isCapability)
    : impliesCapability(fallback.other, isCapability)
}

function capabilityOwner(
  node: AstNode,
  isCapability: IsCapability
): string | undefined {
  const expression = unwrap(node)
  if (expression.type !== 'MemberExpression' || expression.computed) {
    return undefined
  }
  if (expression.property.name === 'value') {
    return capabilityOwner(expression.object, isCapability)
  }
  return isCapability(expression) ? memberPath(expression.object) : undefined
}

// `caps ? caps.can_top_up : false` is `caps?.can_top_up ?? false`.
function isPresenceDefault(node: Ternary, isCapability: IsCapability): boolean {
  const fallback = literalDefault(node)
  if (!fallback) return false
  const negatedTest = negated(node.test)
  const owner = capabilityOwner(fallback.other, isCapability)
  return (
    owner !== undefined &&
    fallback.isConsequent === (negatedTest !== undefined) &&
    memberPath(negatedTest ?? node.test) === owner
  )
}

export const noCapabilityRecombination: Rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Prevent combining a server capability with other client state'
    },
    schema: [],
    messages: {
      combined: `A server capability is combined with other state through \`{{operator}}\`. Only local UI state may narrow it, as in \`canTopUp && !isLoading\`. ${GUIDANCE}`,
      chosen: `A server capability is chosen by a client-side condition. ${GUIDANCE}`
    }
  },
  create(context) {
    const capabilityBindings = new Set<string>()
    const capabilityObjects = new Set<string>()

    const isCapabilityReference = (node: AstNode): boolean => {
      if (node.type === 'Identifier') return capabilityBindings.has(node.name)
      if (node.type !== 'MemberExpression' || node.computed) return false
      const property = node.property.name
      return (
        CAPABILITY_FIELD.test(property) ||
        (CAPABILITY_BINDING.test(property) &&
          capabilityObjects.has(factName(node.object) ?? ''))
      )
    }

    const isCapabilitySource = (init: AstNode | null): boolean =>
      isCapabilitySourceCall(init) ||
      (init !== null && capabilityObjects.has(factName(init) ?? ''))

    const containsCapability = (node: AstNode): boolean =>
      !isPendingFactCall(node) &&
      (isCapabilityReference(node) || childNodes(node).some(containsCapability))

    const isCapabilityValue = (node: AstNode): boolean => {
      const expression = unwrap(node)
      return expression.type === 'MemberExpression' &&
        !expression.computed &&
        expression.property.name === 'value'
        ? isCapabilityValue(expression.object)
        : isCapabilityReference(expression)
    }

    const onlyNarrowedByLocalState = (node: AstNode): boolean =>
      impliesCapability(node, isCapabilityValue) ||
      isDisabledWithoutCapability(node, isCapabilityValue)

    const onlyDefaultsCapability = (node: Ternary): boolean =>
      isNarrowedTernary(node, isCapabilityValue) ||
      isPresenceDefault(node, isCapabilityReference)

    const isUnchosenCapability = (node: Ternary): boolean =>
      isLiteral(node.test) ||
      !(
        containsCapability(node.consequent) ||
        containsCapability(node.alternate)
      ) ||
      onlyDefaultsCapability(node) ||
      isInsidePendingFact(node)

    const isCapabilityRecord = (node: AstNode): boolean => {
      const expression = unwrap(node)
      return (
        expression.type === 'ObjectExpression' &&
        expression.properties.some(
          (property) =>
            property.type === 'Property' &&
            !property.computed &&
            property.key.type === 'Identifier' &&
            CAPABILITY_BINDING.test(property.key.name) &&
            containsCapability(property.value)
        )
      )
    }

    const trackBinding = (name: string, init: AstNode) => {
      if (isCapabilitySourceCall(init)) {
        capabilityObjects.add(name)
        return
      }
      if (passesFieldThrough(name, init)) {
        capabilityBindings.add(name)
        return
      }
      if (!containsCapability(init)) return
      const values = boundValues(init)
      if (values.some(isCapabilityRecord)) capabilityObjects.add(name)
      else if (
        joinKinds(
          values.map((value) => valueKind(value, isCapabilityValue))
        ) === 'boolean'
      ) {
        capabilityBindings.add(name)
      }
    }

    return {
      VariableDeclarator({ id, init }) {
        if (id.type === 'Identifier') {
          if (init) trackBinding(id.name, init)
          return
        }
        if (id.type !== 'ObjectPattern' || !isCapabilitySource(init)) return
        for (const name of destructuredCapabilities(id)) {
          capabilityBindings.add(name)
        }
      },
      LogicalExpression(node) {
        if (unwrap(node.parent).type === 'LogicalExpression') return
        const operands = logicalOperands(node)
        const factOperands = operands.filter((operand) => !isLiteral(operand))
        if (
          factOperands.length < 2 ||
          !operands.some(containsCapability) ||
          onlyNarrowedByLocalState(node) ||
          isInsidePendingFact(node)
        ) {
          return
        }
        context.report({
          node,
          messageId: 'combined',
          data: { operator: node.operator }
        })
      },
      ConditionalExpression(node) {
        if (isUnchosenCapability(node)) return
        context.report({ node, messageId: 'chosen' })
      }
    }
  }
}

type Binary = Extract<AstNode, { type: 'BinaryExpression' }>

interface FactComparison {
  field: string
  literal: string
  path: string | undefined
}

function factComparison(node: Binary): FactComparison | undefined {
  if (!EQUALITY_OPERATORS.has(node.operator)) return undefined
  const leftLiteral = stringLiteral(node.left)
  const [literal, compared] =
    leftLiteral === undefined
      ? [stringLiteral(node.right), node.left]
      : [leftLiteral, node.right]
  const field = factName(compared)
  if (literal === undefined || field === undefined) return undefined
  const isFactLiteral = isRoleField(field)
    ? isRoleValue
    : COMPARED_FACTS.get(field)
  return isFactLiteral?.(literal)
    ? { field, literal, path: memberPath(compared) }
    : undefined
}

function enclosingFunction(node: AstNode): FunctionLike | undefined {
  const { parent } = node
  if (parent === null) return undefined
  return isFunctionLike(parent) ? parent : enclosingFunction(parent)
}

// A runtime guard such as `value is Workspace` validates a payload's shape.
function isInsideTypeGuard(node: AstNode): boolean {
  return (
    enclosingFunction(node)?.returnType?.typeAnnotation.type ===
    'TSTypePredicate'
  )
}

const LABEL_CALLEES: ReadonlySet<string> = new Set(['t', '$t'])
const SORT_METHODS: ReadonlySet<string> = new Set(['sort', 'toSorted'])

function isLabel(node: AstNode | null | undefined): boolean {
  if (!node) return false
  const expression = unwrap(node)
  return (
    expression.type === 'CallExpression' &&
    LABEL_CALLEES.has(factName(expression.callee) ?? '')
  )
}

// The value a branch yields: `return x`, or a block holding only `return x`.
function returnedBy(statement: AstNode): AstNode | null | undefined {
  if (statement.type === 'ReturnStatement') return statement.argument
  if (statement.type !== 'BlockStatement' || statement.body.length !== 1) {
    return undefined
  }
  return returnedBy(statement.body[0])
}

type Branch = AstNode | null | undefined

// What a ternary or an `if` picks when `test` is its whole condition.
function conditionBranches(test: AstNode): Branch[] | undefined {
  const { parent } = test
  if (parent?.type === 'ConditionalExpression' && parent.test === test) {
    return [parent.consequent, parent.alternate]
  }
  if (parent?.type !== 'IfStatement' || parent.test !== test) return undefined
  const { consequent, alternate } = parent
  return alternate === null
    ? [returnedBy(consequent)]
    : [returnedBy(consequent), returnedBy(alternate)]
}

// `role === 'owner' ? t('owner') : t('member')` picks copy, not a gate.
function selectsLabel(node: AstNode): boolean {
  return conditionBranches(node)?.every(isLabel) ?? false
}

function isInsideSortComparator(node: AstNode): boolean {
  const comparator = enclosingFunction(node)
  const call = comparator?.parent
  if (call?.type !== 'CallExpression' || call.arguments[0] !== comparator) {
    return false
  }
  const callee = unwrap(call.callee)
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    SORT_METHODS.has(callee.property.name)
  )
}

const STATUS_FIELDS: ReadonlySet<string> = new Set([
  'billingStatus',
  'subscriptionStatus',
  'billing_status',
  'subscription_status'
])

function logicalRoot(node: AstNode): AstNode {
  const { parent } = node
  return parent?.type === 'LogicalExpression' ? logicalRoot(parent) : node
}

function isBooleanLiteral(node: AstNode | null | undefined): boolean {
  return node?.type === 'Literal' && typeof node.value === 'boolean'
}

// A branch that returns `true` or `false` turns the condition into one step of
// a composed gate, so only branches that pick a value read the status as is.
function branchesOnValue(test: AstNode): boolean {
  return (
    conditionBranches(test)?.every((branch) => !isBooleanLiteral(branch)) ??
    false
  )
}

// `billingStatus === 'paused' ? a : b` renders one status as received; joined
// with another fact, role or flag it derives a decision.
function isStatusReadAsIs(node: Binary, { field, path }: FactComparison) {
  if (!STATUS_FIELDS.has(field) || path === undefined) return false
  const root = logicalRoot(node)
  return (
    logicalOperands(root).every(
      (operand) =>
        operand.type === 'BinaryExpression' &&
        factComparison(operand)?.path === path
    ) && branchesOnValue(root)
  )
}

function isExemptComparison(node: Binary, comparison: FactComparison): boolean {
  return (
    isInsidePendingFact(node) ||
    isInsideTypeGuard(node) ||
    selectsLabel(node) ||
    isInsideSortComparator(node) ||
    isStatusReadAsIs(node, comparison)
  )
}

export const noServerFactLiterals: Rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Prevent deriving gates from server role, tier, status or message literals'
    },
    schema: [],
    messages: {
      compared: `\`{{field}}\` is compared with the literal '{{literal}}'. ${GUIDANCE}`,
      roleFallback: `A missing role falls back to '{{literal}}'. ${GUIDANCE}`,
      messageMatch: `A server message is matched as text. ${GUIDANCE}`
    }
  },
  create(context) {
    const matchesServerMessages = SERVER_MESSAGE_FILE.test(
      context.filename.replaceAll('\\', '/')
    )
    return {
      BinaryExpression(node) {
        const comparison = factComparison(node)
        if (!comparison || isExemptComparison(node, comparison)) return
        const { field, literal } = comparison
        context.report({
          node,
          messageId: 'compared',
          data: { field, literal }
        })
      },
      LogicalExpression(node) {
        const literal = stringLiteral(node.right)
        if (
          !ROLE_FALLBACK_OPERATORS.has(node.operator) ||
          literal === undefined ||
          !isRoleValue(literal) ||
          !isRoleField(factName(node.left) ?? '') ||
          isInsidePendingFact(node)
        ) {
          return
        }
        context.report({ node, messageId: 'roleFallback', data: { literal } })
      },
      CallExpression(node) {
        const callee = unwrap(node.callee)
        if (
          !matchesServerMessages ||
          callee.type !== 'MemberExpression' ||
          callee.computed ||
          callee.property.name !== 'includes' ||
          !SERVER_MESSAGE_NAME.test(factName(callee.object) ?? '') ||
          isInsidePendingFact(node)
        ) {
          return
        }
        context.report({ node, messageId: 'messageMatch' })
      }
    }
  }
}

export default {
  meta: { name: 'comfy' },
  rules: {
    'no-capability-recombination': noCapabilityRecombination,
    'no-server-fact-literals': noServerFactLiterals
  }
}
