import type { RuleTester } from 'oxlint/plugins-dev'

type Rule = Parameters<RuleTester['run']>[1]
type Create = NonNullable<Rule['create']>
type Visitor = ReturnType<Create>
type VisitedNode<K extends keyof Visitor> = Parameters<
  NonNullable<Visitor[K]>
>[0]
type Expression = VisitedNode<'LogicalExpression'>['left']
type AstNode = Expression['parent']

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
  'inFlight'
])

const ROLE_VALUES: ReadonlySet<string> = new Set(['owner', 'member', 'admin'])
const isRoleValue = (literal: string) => ROLE_VALUES.has(literal)
const anyString = () => true

const COMPARED_FACTS: ReadonlyMap<string, (literal: string) => boolean> =
  new Map([
    ['role', isRoleValue],
    ['tier', anyString],
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
  return LOCAL_UI_STATE.has(referenceName(expression) ?? '')
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

    return {
      VariableDeclarator({ id, init }) {
        if (id.type === 'Identifier') {
          if (isCapabilitySourceCall(init)) capabilityObjects.add(id.name)
          else if (init && containsCapability(init)) {
            capabilityBindings.add(id.name)
          }
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
        if (
          isLiteral(node.test) ||
          !(
            containsCapability(node.consequent) ||
            containsCapability(node.alternate)
          ) ||
          isInsidePendingFact(node)
        ) {
          return
        }
        context.report({ node, messageId: 'chosen' })
      }
    }
  }
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
    return {
      BinaryExpression(node) {
        if (!EQUALITY_OPERATORS.has(node.operator)) return
        const leftLiteral = stringLiteral(node.left)
        const [literal, compared] =
          leftLiteral === undefined
            ? [stringLiteral(node.right), node.left]
            : [leftLiteral, node.right]
        const field = factName(compared)
        if (
          literal === undefined ||
          field === undefined ||
          !(COMPARED_FACTS.get(field)?.(literal) ?? false) ||
          isInsidePendingFact(node)
        ) {
          return
        }
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
          factName(node.left) !== 'role' ||
          isInsidePendingFact(node)
        ) {
          return
        }
        context.report({ node, messageId: 'roleFallback', data: { literal } })
      },
      CallExpression(node) {
        const callee = unwrap(node.callee)
        if (
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
