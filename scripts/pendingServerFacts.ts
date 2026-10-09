type TicketReference = {
  line: number
  /** `null` when the first argument is not a ticket string literal. */
  ticket: string | null
}

export type IssueState = { type: string; name: string }

export type IssueNode = { identifier: string; state: IssueState }

type ExpiredTickets = {
  closed: { ticket: string; state: string }[]
  unknown: string[]
}

const CALL_PATTERN = /pendingServerFact\s*\(([^,)]*)/g
const TICKET_LITERAL = /^(['"`])(BE-\d+)\1$/

const CLOSED_STATE_TYPES = new Set(['completed', 'canceled'])

// `issue(id:)` is non-nullable in Linear's schema, so one unknown ticket would
// null the whole aliased response. A filter simply omits unknown tickets.
export const ISSUE_STATES_QUERY = `query PendingServerFacts($numbers: [Float!]) {
  issues(first: 250, filter: { team: { key: { eq: "BE" } }, number: { in: $numbers } }) {
    nodes { identifier state { type name } }
  }
}`

const lineAt = (source: string, index: number): number =>
  source.slice(0, index).split('\n').length

export function extractTickets(source: string): TicketReference[] {
  return [...source.matchAll(CALL_PATTERN)].map((match) => ({
    line: lineAt(source, match.index),
    ticket: TICKET_LITERAL.exec(match[1].trim())?.[2] ?? null
  }))
}

export function indexIssueStates(
  tickets: readonly string[],
  nodes: readonly IssueNode[]
): Record<string, IssueState | null> {
  const states = new Map(nodes.map((node) => [node.identifier, node.state]))
  return Object.fromEntries(
    tickets.map((ticket) => [ticket, states.get(ticket) ?? null])
  )
}

export function expiredTickets(
  states: Record<string, IssueState | null>
): ExpiredTickets {
  const entries = Object.entries(states)
  return {
    closed: entries.flatMap(([ticket, state]) =>
      state && CLOSED_STATE_TYPES.has(state.type)
        ? [{ ticket, state: state.name }]
        : []
    ),
    unknown: entries.flatMap(([ticket, state]) => (state ? [] : [ticket]))
  }
}

export type CheckMode = 'online' | 'offline'

type Preflight =
  | { kind: 'pass'; message: string }
  | { kind: 'fail'; lines: string[] }
  | { kind: 'query'; apiKey: string }

export function preflight({
  mode,
  tickets,
  nonLiteral,
  readApiKey
}: {
  mode: CheckMode
  tickets: readonly string[]
  nonLiteral: readonly string[]
  readApiKey: () => string | undefined
}): Preflight {
  if (nonLiteral.length) {
    return {
      kind: 'fail',
      lines: [
        "pendingServerFact needs a 'BE-<number>' string literal as its first argument so its expiry can be checked:",
        ...nonLiteral.map((location) => `  ${location}`)
      ]
    }
  }
  if (!tickets.length) {
    return {
      kind: 'pass',
      message: 'No pendingServerFact call sites. Nothing to check.'
    }
  }
  if (mode === 'offline') {
    return {
      kind: 'pass',
      message: `${tickets.length} pendingServerFact ticket(s) are well-formed; expiry is checked by the scheduled job on main.`
    }
  }
  const apiKey = readApiKey()
  if (!apiKey) {
    return {
      kind: 'fail',
      lines: [
        `Found ${tickets.length} pendingServerFact ticket(s) (${tickets.join(', ')}) but LINEAR_API_KEY is not set.`,
        'Set the LINEAR_API_KEY secret so their expiry can be checked.'
      ]
    }
  }
  return { kind: 'query', apiKey }
}
