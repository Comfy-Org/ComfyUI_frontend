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
